import gram from "@/assets/gram.png";
import ads from "@/assets/ads.png";

const SRC: Record<string, string> = {
  USDT: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  GRAM: gram,
  ADS: ads,
};

export function Coin({ c, size = 28 }: { c: string; size?: number }) {
  if (c === "ADS") {
    return (
      <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent" style={{ width: size, height: size }}>
        <img src={SRC['ADS']} alt="ADS" width={size} height={size} className="scale-[1.6] object-contain" />
      </span>
    );
  }
  return <img src={SRC[c]} alt={c} width={size} height={size} className="shrink-0 rounded-full object-contain" style={{ width: size, height: size }} />;
}
