// Placeholder for modules not yet built, so navigation never dead-ends.
export default function ComingSoon({
  title,
  module,
  blurb,
}: {
  title: string;
  module: string;
  blurb: string;
}) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{module}</div>
          <h1>{title}</h1>
          <p>{blurb}</p>
        </div>
      </div>
      <section className="card">
        <div className="card-body">
          <p className="empty-note">
            Not built yet. This screen arrives in {module}, ported from the agreed prototype so the
            layout and commercial model match what you&rsquo;ve already signed off.
          </p>
        </div>
      </section>
    </div>
  );
}
