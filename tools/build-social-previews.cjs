const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const WIDTH = 1200;
const HEIGHT = 630;

const cards = [
  {
    output: "public/social/main-preview.jpg",
    image: "public/night-sky-original.jpg",
    kind: "main",
    title: [],
    alt: "Sergey Haeniken — DevOps, DevSecOps, SRE",
  },
  {
    output: "public/social/articles-preview.jpg",
    image: "public/astronomer-2-960.webp",
    kind: "article",
    title: ["TECHNICAL", "PUBLICATIONS"],
    alt: "Technical publications by Sergey Haeniken",
  },
  {
    output: "public/social/lab-preview.jpg",
    image: "public/lab-sky.jpg",
    kind: "article",
    title: ["ORBITAL", "CLUSTER", "INCIDENT LAB"],
    alt: "Cluster Orbit incident-response lab",
  },
  {
    output: "public/social/astrosferum-preview.jpg",
    image: "public/astrosferum/night-telescope-1448.webp",
    kind: "article",
    title: ["ASTROSFERUM", "FORECAST FOR AN", "ASTRONOMER"],
    alt: "Astrosferum — forecast for an astronomer",
  },
  {
    output: "public/social/network-ha-preview.jpg",
    image: "design/social/network-ha-visual-source.png",
    kind: "article",
    title: ["BGP / BFD", "PRODUCTION", "FAILOVER"],
    alt: "BGP and BFD production failover",
  },
  {
    output: "public/social/rabbithole-preview.jpg",
    image: "public/rabbithole/rabbit-background-poster.webp",
    kind: "article",
    title: ["PAYMENTS &", "SUBSCRIPTIONS", "3X-UI STATE"],
    alt: "Payments, subscriptions and 3x-ui state",
  },
  {
    output: "public/social/incident-504-preview.jpg",
    image: "design/social/incident-504-visual-source.svg",
    kind: "article",
    title: ["504 TIMEOUT", "DECISION", "MAP"],
    alt: "Engineering decision map from 504 to a slow SQL query",
  },
];

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]);
}

function brand(x, y, size, main = false) {
  if (main) {
    return `
      <text x="${x}" y="${y}" class="main-name">SERGEY</text>
      <text x="${x}" y="${y + size * 1.02}" class="main-name"><tspan>HA</tspan><tspan fill="#ff624d">E</tspan><tspan>NIKEN</tspan></text>`;
  }
  return `<text x="${x}" y="${y}" class="article-brand"><tspan>SERGEY HA</tspan><tspan fill="#ff624d">E</tspan><tspan>NIKEN</tspan></text>`;
}

function titleBlock(lines) {
  const sizes = lines.length === 3 ? [54, 51, 58] : lines.map(() => 58);
  const startY = lines[0] === "ASTROSFERUM" ? 205 : 210;
  return lines.map((line, index) => {
    const size = sizes[index];
    const y = startY + index * 72;
    const accent = index === 0 ? " title-accent" : "";
    return `<text x="64" y="${y}" class="article-title${accent}" font-size="${size}">${escapeXml(line)}</text>`;
  }).join("\n");
}

function motif(kind) {
  if (kind === "main") {
    return `
      <circle cx="468" cy="186" r="176" class="orbit"/>
      <circle cx="468" cy="186" r="112" class="orbit cyan"/>
      <circle cx="576" cy="153" r="5" class="node orange"/>
      <path d="M78 470 C210 420 318 486 516 432" class="signal"/>`;
  }
  return `
    <circle cx="500" cy="154" r="142" class="orbit"/>
    <circle cx="500" cy="154" r="88" class="orbit cyan"/>
    <path d="M58 456 C170 398 296 480 548 414" class="signal"/>
    <circle cx="178" cy="424" r="5" class="node cyan-fill"/>
    <circle cx="410" cy="439" r="5" class="node orange"/>
    <path d="M78 118 H420" class="rule"/>
    <circle cx="426" cy="118" r="4" class="node orange"/>`;
}

async function imageDataUri(input) {
  const buffer = await sharp(path.join(root, input))
    .resize({ width: 690, height: HEIGHT, fit: "cover", position: "centre" })
    .jpeg({ quality: 88, progressive: true, chromaSubsampling: "4:2:0", mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

function svg(card, imageUri) {
  const main = card.kind === "main";
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <clipPath id="visual-clip"><path d="M570 0H1200V630H535Z"/></clipPath>
      <linearGradient id="visual-shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#07111f" stop-opacity=".58"/>
        <stop offset=".24" stop-color="#07111f" stop-opacity=".12"/>
        <stop offset="1" stop-color="#07111f" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="paper-edge" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#edf0e9" stop-opacity="1"/>
        <stop offset=".72" stop-color="#edf0e9" stop-opacity=".88"/>
        <stop offset="1" stop-color="#edf0e9" stop-opacity="0"/>
      </linearGradient>
      <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse">
        <path d="M42 0H0V42" fill="none" stroke="#07111f" stroke-opacity=".055" stroke-width="1"/>
        <circle cx="0" cy="0" r="1.4" fill="#07111f" fill-opacity=".13"/>
      </pattern>
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".74" numOctaves="2" seed="8"/>
        <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .055 0"/>
      </filter>
      <filter id="glow"><feGaussianBlur stdDeviation="5"/></filter>
    </defs>

    <rect width="1200" height="630" fill="#edf0e9"/>
    <rect x="0" y="0" width="620" height="630" fill="url(#grid)"/>
    <g clip-path="url(#visual-clip)">
      <image href="${imageUri}" x="510" y="0" width="690" height="630" preserveAspectRatio="xMidYMid slice"/>
      <rect x="510" width="690" height="630" fill="url(#visual-shade)"/>
      <circle cx="1030" cy="180" r="190" fill="none" stroke="#73d5da" stroke-opacity=".20" stroke-width="1"/>
      <circle cx="1030" cy="180" r="132" fill="none" stroke="#ff7657" stroke-opacity=".25" stroke-width="1"/>
      <path d="M620 500C760 426 902 536 1160 430" fill="none" stroke="#73d5da" stroke-opacity=".32" stroke-width="1.4"/>
      <circle cx="824" cy="466" r="4" fill="#73d5da"/>
      <circle cx="1064" cy="463" r="4" fill="#ff7657"/>
      <path d="M876 0L1168 630" stroke="#f7faf7" stroke-opacity=".09"/>
    </g>
    <rect x="520" y="0" width="142" height="630" fill="url(#paper-edge)"/>

    <g fill="none" stroke="#07111f" stroke-opacity=".14" stroke-width="1">${motif(card.kind)}</g>
    <g class="copy">
      ${brand(64, main ? 235 : 82, main ? 106 : 34, main)}
      ${main ? "" : titleBlock(card.title)}
      <g transform="translate(64 536)">
        <rect x="0" y="-15" width="42" height="4" fill="#ff624d"/>
        <text x="58" y="0" class="roles"><tspan>DEVOPS</tspan><tspan fill="#ff624d"> / </tspan><tspan>DEVSECOPS</tspan><tspan fill="#ff624d"> / </tspan><tspan>SRE</tspan></text>
      </g>
    </g>

    <path d="M570 0L535 630" stroke="#73d5da" stroke-opacity=".38" stroke-width="1"/>
    <path d="M577 0L542 630" stroke="#ff7657" stroke-opacity=".35" stroke-width="2"/>
    <rect width="1200" height="630" filter="url(#grain)" opacity=".5"/>

    <style>
      .main-name { fill:#07111f; font-family:'DejaVu Sans',sans-serif; font-size:106px; font-weight:900; letter-spacing:-7px; }
      .article-brand { fill:#07111f; font-family:'DejaVu Sans',sans-serif; font-size:34px; font-weight:900; letter-spacing:-1.8px; }
      .article-title { fill:#07111f; font-family:'DejaVu Sans',sans-serif; font-weight:900; letter-spacing:-2.3px; }
      .title-accent { fill:#0c6470; }
      .roles { fill:#07111f; font-family:'DejaVu Sans',sans-serif; font-size:19px; font-weight:800; letter-spacing:1.2px; }
      .orbit { fill:none; stroke:#07111f; stroke-opacity:.14; }
      .orbit.cyan { stroke:#2b929b; stroke-opacity:.25; }
      .rule { stroke:#07111f; stroke-opacity:.22; }
      .signal { fill:none; stroke:#2b929b; stroke-opacity:.38; stroke-width:1.5; }
      .node { stroke:none; }
      .node.orange, .orange { fill:#ff624d; }
      .node.cyan-fill { fill:#2b929b; }
    </style>
  </svg>`;
}

async function build(card) {
  const inputUri = await imageDataUri(card.image);
  const output = path.join(root, card.output);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp(Buffer.from(svg(card, inputUri)))
    .jpeg({ quality: 86, progressive: true, chromaSubsampling: "4:2:0", mozjpeg: true })
    .toFile(output);
  const metadata = await sharp(output).metadata();
  console.log(`${card.output}: ${metadata.width}x${metadata.height} — ${card.alt}`);
}

Promise.all(cards.map(build)).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
