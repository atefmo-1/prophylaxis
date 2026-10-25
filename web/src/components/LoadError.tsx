// What a page shows when its data can't be read: what failed, the browser's reason, and a way to try again.
export function LoadError({ what, detail }: { what: string; detail?: string }) {
  return (
    <div className="load-error" role="alert">
      <p>Couldn't load {what}.</p>
      {detail && <p className="load-error-detail">{detail}</p>}
      <button type="button" className="load-error-retry" onClick={() => window.location.reload()}>
        Try again
      </button>
    </div>
  );
}
