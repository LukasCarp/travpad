type Credit = {
  artist?: string | null;
  license_short?: string | null;
  license_url?: string | null;
  file_page?: string | null;
} | null | undefined;

type Props = {
  credit: Credit;
  className?: string;
};

// Inline photographer + license credit for a Commons-sourced image. CC BY
// and CC BY-SA both require the credit to be visible at the work itself,
// not buried on a separate /credits page.
export default function PhotoCredit({ credit, className = "" }: Props) {
  if (!credit) return null;
  const { artist, license_short, license_url, file_page } = credit;
  if (!artist && !license_short && !file_page) return null;

  const licenseText = license_short ?? "license";
  const license = license_url ? (
    <a
      href={license_url}
      target="_blank"
      rel="noopener noreferrer"
      className="underline-offset-2 hover:underline"
    >
      {licenseText}
    </a>
  ) : (
    <span>{licenseText}</span>
  );

  const fileLink = file_page ? (
    <a
      href={file_page}
      target="_blank"
      rel="noopener noreferrer"
      className="underline-offset-2 hover:underline"
    >
      Commons
    </a>
  ) : null;

  return (
    <p
      className={
        "text-[10px] leading-relaxed text-neutral-500 dark:text-neutral-400 " +
        className
      }
    >
      Photo:{" "}
      {artist && (
        <span className="text-neutral-600 dark:text-neutral-300">
          {artist}
        </span>
      )}
      {artist && " · "}
      {license}
      {fileLink && " · "}
      {fileLink}
    </p>
  );
}
