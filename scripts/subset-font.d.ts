// Minimal types for subset-font (the package ships none).
declare module 'subset-font' {
  export default function subsetFont(
    font: Uint8Array,
    text: string,
    options?: { targetFormat?: 'sfnt' | 'woff' | 'woff2' | 'truetype' },
  ): Promise<Uint8Array>;
}
