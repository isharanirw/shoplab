import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiRequestError } from '../api/client';
import type { Cart, Country, ListResponse, Order, Quote, SavedAddress, ShippingMethod } from '../api/types';
import { useCart } from '../cart/CartContext';
import { AddressStep } from '../checkout/AddressStep';
import type { AddressChoice } from '../checkout/AddressStep';
import { CheckoutSummary } from '../checkout/CheckoutSummary';
import { DeliveryStep } from '../checkout/DeliveryStep';
import { PaymentStep } from '../checkout/PaymentStep';
import { describeAddress, ReviewStep } from '../checkout/ReviewStep';
import { ErrorState, Spinner } from '../components/Feedback';
import { useFetch } from '../hooks/useFetch';
import { EMPTY_ADDRESS, validateAddressForm } from '../lib/address';
import type { AddressErrors, AddressForm } from '../lib/address';
import type { CardToken } from '../lib/card';
import { deliveryWindow, disabledReason } from '../lib/delivery';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from '../checkout/Checkout.module.css';

/** How long the spinner shows after "Place order", in milliseconds (the requirement is 1 to 2 seconds). */
export const PLACE_ORDER_SPINNER_MS = 1500;

type Step = 1 | 2 | 3 | 4;
const STEPS: { id: Step; label: string; testId: string }[] = [
  { id: 1, label: 'Shipping address', testId: 'checkout-step-address' },
  { id: 2, label: 'Delivery', testId: 'checkout-step-delivery' },
  { id: 3, label: 'Payment', testId: 'checkout-step-payment' },
  { id: 4, label: 'Review', testId: 'checkout-step-review' },
];

export function CheckoutPage() {
  useDocumentTitle('Checkout');
  const cartCtx = useCart();
  const syncing = cartCtx.syncing;
  const cart = useFetch<Cart>(syncing ? null : '/api/cart');
  const countries = useFetch<ListResponse<Country>>('/api/countries');
  const addresses = useFetch<ListResponse<SavedAddress>>('/api/addresses');

  const failed = [cart, countries, addresses].find((r) => r.status === 'error');
  let body: ReactNode;
  if (failed && failed.status === 'error') {
    body = (
      <ErrorState
        message={failed.error.message}
        onRetry={() => {
          cart.retry();
          countries.retry();
          addresses.retry();
        }}
      />
    );
  } else if (syncing || cart.status !== 'success' || countries.status !== 'success' || addresses.status !== 'success') {
    body = <Spinner label="Loading checkout" />;
  } else if (cart.data.items.length === 0) {
    body = (
      <div className={styles.emptyBox} data-testid="checkout-empty">
        <p>Your cart is empty, so there is nothing to check out.</p>
        <Link to="/products" className="btn btn-primary">
          Browse products
        </Link>
      </div>
    );
  } else {
    body = <CheckoutFlow cart={cart.data} countries={countries.data.data} saved={addresses.data.data} />;
  }

  return (
    <section aria-labelledby="checkout-heading">
      <h1 id="checkout-heading">Checkout</h1>
      {body}
    </section>
  );
}

interface FlowProps {
  cart: Cart;
  countries: Country[];
  saved: SavedAddress[];
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function CheckoutFlow({ cart, countries, saved }: FlowProps) {
  const navigate = useNavigate();
  const cartCtx = useCart();
  const defaultAddress = saved.find((a) => a.isDefault) ?? saved[0];

  const [step, setStep] = useState<Step>(1);
  const [choice, setChoice] = useState<AddressChoice>(defaultAddress ? defaultAddress.id : 'new');
  const [form, setForm] = useState<AddressForm>(EMPTY_ADDRESS);
  const [addressErrors, setAddressErrors] = useState<AddressErrors>({});
  const [method, setMethod] = useState<ShippingMethod>('standard');
  const [date, setDate] = useState<string | null>(null);
  const [dateNote, setDateNote] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [payment, setPayment] = useState<CardToken | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [terms, setTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const [problems, setProblems] = useState<Record<number, string>>({});
  const [visitedPayment, setVisitedPayment] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const range = useMemo(() => deliveryWindow(new Date()), []);

  const selectedSaved = choice === 'new' ? undefined : saved.find((a) => a.id === choice);
  const quoteCountry = selectedSaved?.countryCode ?? (form.countryCode || countries[0]?.code || 'SE');

  // Totals preview for the chosen shipping method and country.
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setQuoteLoading(true);
    api<Quote>('/api/checkout/quote', { method: 'POST', body: { shippingMethod: method, country: quoteCountry }, signal: controller.signal })
      .then((q) => {
        if (controller.signal.aborted) return;
        setQuote(q);
        setQuoteError(null);
        setQuoteLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setQuoteError(err instanceof ApiRequestError ? err.message : 'Could not calculate your totals.');
        setQuoteLoading(false);
      });
    return () => controller.abort();
  }, [method, quoteCountry, quoteAttempt]);

  // Move focus to the step heading when the step changes so screen reader users hear where they are.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  function goTo(next: Step) {
    if (next === 3) setVisitedPayment(true);
    setPlaceError(null);
    setStep(next);
  }

  function chooseMethod(next: ShippingMethod) {
    setMethod(next);
    setDeliveryError(null);
    if (date && disabledReason(date, range, next)) {
      setDate(null);
      setDateNote('Your delivery date was cleared because Standard delivery is not available at weekends. Please choose another day.');
    } else {
      setDateNote(null);
    }
  }

  function nextFromAddress() {
    if (choice === 'new') {
      const errors = validateAddressForm(form, countries);
      setAddressErrors(errors);
      const first = (Object.keys(EMPTY_ADDRESS) as (keyof AddressForm)[]).find((f) => errors[f]);
      if (first) {
        document.getElementById(`addr-${first}`)?.focus();
        return;
      }
    }
    goTo(2);
  }

  function nextFromDelivery() {
    if (!date) {
      setDeliveryError('Choose a delivery date to continue.');
      return;
    }
    if (disabledReason(date, range, method)) {
      setDeliveryError('That date is not available for this shipping method.');
      return;
    }
    setDeliveryError(null);
    goTo(3);
  }

  function nextFromPayment() {
    if (!payment) {
      setPaymentError('Enter your card details and choose "Use this card" to continue.');
      return;
    }
    setPaymentError(null);
    goTo(4);
  }

  async function placeOrder() {
    if (!terms) {
      setTermsError('You must accept the terms and conditions to place your order.');
      document.getElementById('accept-terms')?.focus();
      return;
    }
    if (!payment || !date) return;
    setTermsError(null);
    setPlaceError(null);
    setDeclined(false);
    setProblems({});
    setPlacing(true);
    const request = api<Order>('/api/orders', {
      method: 'POST',
      body: {
        shippingMethod: method,
        deliveryDate: date,
        ...(selectedSaved ? { addressId: selectedSaved.id } : { address: form }),
        paymentToken: payment.token,
        acceptTerms: true,
      },
    });
    // The spinner always shows for the same fixed time, even when the request fails quickly.
    const [outcome] = await Promise.allSettled([request, delay(PLACE_ORDER_SPINNER_MS)]);
    setPlacing(false);
    if (outcome.status === 'fulfilled') {
      cartCtx.resetServerCount();
      navigate(`/orders/${outcome.value.id}/confirmation`, { replace: true });
      return;
    }
    handleFailure(outcome.reason);
  }

  function handleFailure(err: unknown) {
    if (!(err instanceof ApiRequestError)) {
      setPlaceError('Something went wrong while placing your order. Please try again.');
      return;
    }
    if (err.status === 402) {
      setDeclined(true);
      setPlaceError('Your card was declined. Your cart has been kept. Please use a different card.');
      return;
    }
    if (err.status === 409) {
      const found: Record<number, string> = {};
      for (const [key, text] of Object.entries(err.fieldErrors)) {
        const match = /^items\.(\d+)$/.exec(key);
        if (match) found[Number(match[1])] = text;
      }
      setProblems(found);
      setPlaceError(`${err.message} Your cart has been kept.`);
      return;
    }
    if (err.status === 401) {
      setPlaceError('Your session has expired. Please log in again.');
      return;
    }
    if (err.status === 400) {
      const keys = Object.keys(err.fieldErrors);
      const target: Step | null = keys.some((k) => k.startsWith('address') || k === 'addressId')
        ? 1
        : keys.some((k) => k === 'deliveryDate' || k === 'shippingMethod')
          ? 2
          : keys.includes('paymentToken')
            ? 3
            : null;
      const detail = Object.values(err.fieldErrors).join(' ');
      setPlaceError(`${err.message}${detail ? ` ${detail}` : ''}`);
      if (target) {
        if (target === 2 && err.fieldErrors.deliveryDate) setDeliveryError(err.fieldErrors.deliveryDate);
        if (target === 3) setPaymentError(err.fieldErrors.paymentToken ?? null);
        setStep(target);
      }
      return;
    }
    setPlaceError(err.message);
  }

  function useDifferentCard() {
    setPayment(null);
    setDeclined(false);
    setPlaceError(null);
    setFrameKey((k) => k + 1);
    setStep(3);
  }

  const { label: addressLabel, lines: addressLines } = describeAddress(selectedSaved, form, countries);
  const current = STEPS[step - 1]!;
  const items = quote?.items ?? cart.items;

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <ol className={styles.steps} aria-label="Checkout progress">
          {STEPS.map((s) => (
            <li
              key={s.id}
              className={s.id === step ? `${styles.stepItem} ${styles.stepCurrent}` : s.id < step ? `${styles.stepItem} ${styles.stepDone}` : styles.stepItem}
              aria-current={s.id === step ? 'step' : undefined}
            >
              <span className={styles.stepNumber} aria-hidden="true">
                {s.id}
              </span>
              <span>
                {s.label}
                {s.id < step && <span className="visually-hidden"> (completed)</span>}
              </span>
            </li>
          ))}
        </ol>

        {STEPS.map((s) => {
          // The payment step stays mounted once visited so the card form keeps what was typed.
          const active = s.id === step;
          if (!active && !(s.id === 3 && visitedPayment)) return null;
          return (
            <section
              key={s.id}
              className={styles.panel}
              hidden={!active}
              aria-labelledby={`step-heading-${s.id}`}
              data-testid={s.testId}
            >
              <h2 id={`step-heading-${s.id}`} ref={active ? headingRef : undefined} tabIndex={-1} className={styles.stepHeading}>
                Step {s.id} of 4: {s.label}
              </h2>
              {s.id === 1 && (
                <AddressStep
                  saved={saved}
                  countries={countries}
                  choice={choice}
                  onChoice={(c) => {
                    setChoice(c);
                    setAddressErrors({});
                  }}
                  form={form}
                  onForm={setForm}
                  errors={addressErrors}
                  onErrors={setAddressErrors}
                />
              )}
              {s.id === 2 && (
                <DeliveryStep
                  method={method}
                  onMethod={chooseMethod}
                  date={date}
                  onDate={(d) => {
                    setDate(d);
                    setDateNote(null);
                    setDeliveryError(null);
                  }}
                  window={range}
                  note={dateNote}
                  error={deliveryError}
                />
              )}
              {s.id === 3 && <PaymentStep payment={payment} onPayment={setPayment} frameKey={frameKey} error={paymentError} />}
              {s.id === 4 && (
                <>
                  <ReviewStep
                    addressLabel={addressLabel}
                    addressLines={addressLines}
                    method={method}
                    date={date}
                    payment={payment}
                    terms={terms}
                    onTerms={(v) => {
                      setTerms(v);
                      if (v) setTermsError(null);
                    }}
                    termsError={termsError}
                    onEdit={goTo}
                  />
                  {placeError && (
                    <div role="alert" className={styles.placeError} data-testid="place-order-error">
                      <p>{placeError}</p>
                      {declined && (
                        <button type="button" className="btn btn-small" onClick={useDifferentCard} data-testid="use-different-card">
                          Use a different card
                        </button>
                      )}
                      {Object.keys(problems).length > 0 && (
                        <p>
                          <Link to="/cart">Go back to your cart</Link> to change the quantities.
                        </p>
                      )}
                    </div>
                  )}
                  {placing && <Spinner label="Placing your order" />}
                </>
              )}
              {active && (
                <div className={styles.nav}>
                  <button type="button" className="btn" disabled={step === 1 || placing} onClick={() => goTo((step - 1) as Step)} data-testid="checkout-back">
                    Back
                  </button>
                  {step === 1 && (
                    <button type="button" className="btn btn-primary" onClick={nextFromAddress} data-testid="checkout-next">
                      Next
                    </button>
                  )}
                  {step === 2 && (
                    <button type="button" className="btn btn-primary" onClick={nextFromDelivery} data-testid="checkout-next">
                      Next
                    </button>
                  )}
                  {step === 3 && (
                    <button type="button" className="btn btn-primary" onClick={nextFromPayment} data-testid="checkout-next">
                      Next
                    </button>
                  )}
                  {step === 4 && (
                    <button type="button" className="btn btn-primary" disabled={placing} onClick={() => void placeOrder()} data-testid="place-order">
                      Place order
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}
        <p className="visually-hidden" role="status">
          {`You are on ${current.label}, step ${step} of 4.`}
        </p>
      </div>

      <div className={styles.side}>
        {quoteError ? (
          <ErrorState message={quoteError} onRetry={() => setQuoteAttempt((n) => n + 1)} />
        ) : (
          <CheckoutSummary items={items} totals={quote?.totals ?? null} coupon={quote?.coupon ?? cart.coupon} problems={problems} loading={quoteLoading} testIdPrefix="summary" />
        )}
      </div>
    </div>
  );
}
