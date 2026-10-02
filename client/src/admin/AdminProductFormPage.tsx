import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiRequestError } from '../api/client';
import type { AdminProduct } from '../api/types';
import { ErrorState, Spinner } from '../components/Feedback';
import { CheckboxField, FormField, SelectField, TextAreaField } from '../components/FormField';
import { ProductImage } from '../components/ProductImage';
import { useFetch } from '../hooks/useFetch';
import {
  buildProductFormData,
  DESCRIPTION_MAX,
  EMPTY_PRODUCT_FORM,
  firstErrorField,
  formErrorsFromServer,
  formFromProduct,
  validateCategory,
  validateDescription,
  validateName,
  validatePrice,
  validateProductForm,
  validateSalePrice,
  validateStock,
  validateSubcategory,
  withCategory,
} from '../lib/adminProduct';
import type { ProductErrors, ProductField, ProductFormValues } from '../lib/adminProduct';
import { formatFileSize, validateImageFile } from '../lib/reviewForm';
import { CATEGORY_NAMES, TAXONOMY } from '../lib/taxonomy';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './Admin.module.css';

/** /admin/products/new and /admin/products/:id/edit. */
export function AdminProductFormPage() {
  const { id } = useParams();
  const editing = id !== undefined;
  useDocumentTitle(editing ? 'Edit product' : 'Add product');
  const result = useFetch<AdminProduct>(editing ? `/api/admin/products/${id}` : null);

  if (!editing) return <ProductForm product={null} />;
  if (result.status === 'loading') return <Spinner label="Loading product" />;
  if (result.status === 'error') {
    if (result.error.status === 404 || result.error.status === 400) {
      return (
        <section aria-labelledby="admin-form-heading">
          <h1 id="admin-form-heading">Product not found</h1>
          <p>There is no product with ID {id}. It may have been deleted.</p>
          <p>
            <Link to="/admin/products">Back to products</Link>
          </p>
        </section>
      );
    }
    return <ErrorState message={result.error.message} onRetry={result.retry} />;
  }
  return <ProductForm product={result.data} />;
}

function ProductForm({ product }: { product: AdminProduct | null }) {
  const navigate = useNavigate();
  const editing = product !== null;
  const hasVariants = product?.hasVariants ?? false;
  const [values, setValues] = useState<ProductFormValues>(product ? formFromProduct(product) : EMPTY_PRODUCT_FORM);
  const [errors, setErrors] = useState<ProductErrors>({});
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Changing this remounts the file input, which is how a chosen file is cleared.
  const [fileKey, setFileKey] = useState(0);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // A preview of the chosen file; the object URL is released when the file changes or the page closes.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function setField<K extends keyof ProductFormValues>(field: K, value: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function chooseCategory(category: string) {
    setValues((prev) => withCategory(prev, category));
    setErrors((prev) => ({ ...prev, category: undefined, subcategory: undefined }));
  }

  function blur(field: ProductField) {
    let message: string | null = null;
    if (field === 'name') message = validateName(values.name);
    else if (field === 'category') message = validateCategory(values.category);
    else if (field === 'subcategory') message = validateSubcategory(values.category, values.subcategory);
    else if (field === 'description') message = validateDescription(values.description);
    else if (field === 'price') message = validatePrice(values.price);
    else if (field === 'salePrice') message = validateSalePrice(values.salePrice, values.price);
    else if (field === 'stock' && !hasVariants) message = validateStock(values.stock);
    setErrors((prev) => {
      const next: ProductErrors = { ...prev, [field]: message ?? undefined };
      // The sale price is judged against the price, so editing the price re-checks a sale price that is already filled in.
      if (field === 'price' && values.salePrice !== '') next.salePrice = validateSalePrice(values.salePrice, values.price) ?? undefined;
      return next;
    });
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    setFile(chosen);
    setErrors((prev) => ({ ...prev, image: validateImageFile(chosen) ?? undefined }));
    if (chosen) setRemoveImage(false);
  }

  function clearFile() {
    setFile(null);
    setErrors((prev) => ({ ...prev, image: undefined }));
    setFileKey((k) => k + 1);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setProblem(null);
    const found = validateProductForm(values, file, hasVariants);
    setErrors(found);
    const first = firstErrorField(found);
    if (first) {
      document.getElementById(`product-${first}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      const body = buildProductFormData(values, { image: file, removeImage, hasVariants });
      const saved = editing
        ? await api<AdminProduct>(`/api/admin/products/${product.id}`, { method: 'PATCH', formData: body })
        : await api<AdminProduct>('/api/admin/products', { method: 'POST', formData: body });
      navigate('/admin/products', { state: { notice: `${editing ? 'Saved' : 'Created'} "${saved.name}" (ID ${saved.id}).` } });
    } catch (err) {
      if (err instanceof ApiRequestError && Object.keys(err.fieldErrors).length > 0) {
        const mapped = formErrorsFromServer(err.fieldErrors);
        setErrors(mapped);
        setProblem(err.message);
        const firstServer = firstErrorField(mapped);
        if (firstServer) document.getElementById(`product-${firstServer}`)?.focus();
      } else {
        setProblem(err instanceof ApiRequestError ? err.message : 'Could not save the product. Please try again.');
      }
      setSaving(false);
    }
  }

  const subcategories = values.category ? (TAXONOMY[values.category] ?? []) : [];
  const currentImage = editing && product.imagePath && !removeImage && !file ? product.imagePath : null;
  const shownImage = previewUrl ?? currentImage;

  return (
    <section aria-labelledby="admin-form-heading">
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/admin/products">Products</Link> / {editing ? 'Edit' : 'Add'}
      </nav>
      <h1 id="admin-form-heading" ref={headingRef} tabIndex={-1}>
        {editing ? `Edit product ${product.id}` : 'Add product'}
      </h1>

      <form onSubmit={(e) => void handleSubmit(e)} noValidate className={styles.form} data-testid="admin-product-form">
        {problem && (
          <p role="alert" className={styles.alert}>
            {problem}
          </p>
        )}
        <FormField
          id="product-name"
          label="Name"
          value={values.name}
          error={errors.name}
          maxLength={200}
          onChange={(e) => setField('name', e.target.value)}
          onBlur={() => blur('name')}
        />
        <div className={styles.twoCol}>
          <SelectField
            id="product-category"
            label="Category"
            placeholder="Choose a category"
            value={values.category}
            error={errors.category}
            options={CATEGORY_NAMES.map((c) => ({ value: c, label: c }))}
            onChange={(e) => chooseCategory(e.target.value)}
            onBlur={() => blur('category')}
          />
          <SelectField
            id="product-subcategory"
            label="Subcategory"
            placeholder={values.category ? 'Choose a subcategory' : 'Choose a category first'}
            value={values.subcategory}
            error={errors.subcategory}
            disabled={values.category === ''}
            options={subcategories.map((s) => ({ value: s, label: s }))}
            onChange={(e) => setField('subcategory', e.target.value)}
            onBlur={() => blur('subcategory')}
          />
        </div>
        <TextAreaField
          id="product-description"
          label="Description (optional)"
          value={values.description}
          error={errors.description}
          hint={`${values.description.trim().length} of ${DESCRIPTION_MAX} characters.`}
          onChange={(e) => setField('description', e.target.value)}
          onBlur={() => blur('description')}
        />
        <div className={styles.twoCol}>
          <FormField
            id="product-price"
            label="Price (USD)"
            inputMode="decimal"
            autoComplete="off"
            hint="From 0.01 to 10,000.00."
            value={values.price}
            error={errors.price}
            onChange={(e) => setField('price', e.target.value)}
            onBlur={() => blur('price')}
          />
          <FormField
            id="product-salePrice"
            label="Sale price (USD, optional)"
            inputMode="decimal"
            autoComplete="off"
            hint="Leave empty for no sale. Must be below the price."
            value={values.salePrice}
            error={errors.salePrice}
            onChange={(e) => setField('salePrice', e.target.value)}
            onBlur={() => blur('salePrice')}
          />
        </div>
        <FormField
          id="product-stock"
          label="Stock"
          inputMode="numeric"
          autoComplete="off"
          hint={hasVariants ? 'This product has options, so its stock is the total of its variants and cannot be edited here.' : 'A whole number from 0 to 10,000.'}
          value={values.stock}
          error={errors.stock}
          readOnly={hasVariants}
          onChange={(e) => setField('stock', e.target.value)}
          onBlur={() => blur('stock')}
        />

        <fieldset className={styles.imageBox}>
          <legend className="visually-hidden">Product image</legend>
          <div className={styles.imagePreview} data-testid="product-image-preview">
            {shownImage ? (
              <ProductImage productId={product?.id ?? 0} name={values.name || 'New product'} imagePath={shownImage} />
            ) : (
              <ProductImage productId={product?.id ?? 0} name={values.name || 'New product'} decorative />
            )}
          </div>
          <div className={styles.imageInfo}>
            <FormField
              id="product-image"
              type="file"
              label="Image (optional)"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              hint={shownImage ? undefined : 'PNG or JPG, up to 2 MB. Without one, a generated placeholder is shown.'}
              error={errors.image}
              key={fileKey}
              onChange={onFileChange}
            />
            {file && (
              <p className={styles.hint} data-testid="product-image-file">
                {file.name} ({formatFileSize(file.size)}){' '}
                <button type="button" className="btn btn-small" onClick={clearFile}>
                  Remove chosen file
                </button>
              </p>
            )}
            {editing && product.imagePath && !file && (
              <CheckboxField
                id="product-removeImage"
                label="Remove the current image"
                checked={removeImage}
                onChange={(e) => setRemoveImage(e.target.checked)}
              />
            )}
          </div>
        </fieldset>

        <CheckboxField
          id="product-active"
          label="Active (shown in the store)"
          checked={values.active}
          onChange={(e) => setField('active', e.target.checked)}
        />

        <div className={styles.formActions}>
          <button type="submit" className="btn btn-primary" disabled={saving} data-testid="admin-product-save">
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Create product'}
          </button>
          <Link to="/admin/products" className="btn">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
