import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap">
      <div className="page-head">
        <span className="eyebrow">Not found</span>
        <h1>We couldn&apos;t find that page</h1>
        <p>
          The meeting or board may have been moved, or the agenda isn&apos;t public yet. Try the{" "}
          <Link href="/meetings">meeting calendar</Link> or the list of{" "}
          <Link href="/bodies">boards and commissions</Link>.
        </p>
      </div>
    </div>
  );
}
