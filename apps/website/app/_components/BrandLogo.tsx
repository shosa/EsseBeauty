import Image from "next/image";

export function BrandLogo({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`brand-logo${inverse ? " brand-logo--inverse" : ""}`}>
      <Image alt="" aria-hidden="true" height={34} priority src="/esse-logo.svg" width={32} />
      <span>EsseBeauty</span>
    </span>
  );
}
