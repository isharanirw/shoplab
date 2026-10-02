import type { Failure } from '../lib/failure';

interface ActionErrorProps {
  failure: Failure;
  className?: string;
  testId?: string;
}

/** The error line under an action that failed, with a Retry button when trying again could help. */
export function ActionError({ failure, className, testId }: ActionErrorProps) {
  return (
    <p role="alert" className={className} data-testid={testId}>
      {failure.message}
      {failure.retry && (
        <>
          {' '}
          <button type="button" className="btn btn-small" onClick={failure.retry}>
            Retry
          </button>
        </>
      )}
    </p>
  );
}
