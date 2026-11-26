import {
  BadgeCheck,
  ChartNoAxesCombined,
  FileCheck2,
  Fingerprint,
  Layers3,
  LockKeyhole,
  Network,
  ScanLine,
  ShieldCheck,
  Users,
  Wallet,
  Handshake,
} from "lucide-react";

export const navigation = [
  ["Home", "home"],
  ["About", "about"],
  ["Features", "features"],
  ["How It Works", "how-it-works"],
  ["Security", "security"],
  ["FAQ", "faq"],
] as const;
export const features = [
  {
    icon: Fingerprint,
    title: "Business Profiles",
    description: "Review business details and reputation signals.",
  },
  {
    icon: Layers3,
    title: "Mudarabah Pools",
    description: "Explore business-specific pools and disclosed terms.",
  },
  {
    icon: Handshake,
    title: "Profit Sharing",
    description: "Share outcomes under documented agreements.",
  },
  {
    icon: ScanLine,
    title: "On-Chain Records",
    description: "Designed for verifiable Solana activity.",
  },
  {
    icon: ShieldCheck,
    title: "CredLayer Signals",
    description: "Context for decisions—not a guarantee of repayment.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Investor Dashboard",
    description: "Track contributions, pools and approved claims.",
  },
];
export const steps = [
  {
    icon: Users,
    title: "Apply",
    actor: "ENTREPRENEUR",
    description: "Submit a funding target and proposed profit-share terms for review.",
  },
  {
    icon: FileCheck2,
    title: "Review",
    actor: "PLATFORM AUTHORITY",
    description: "The platform authority reviews the proposal before a funding pool is created.",
  },
  {
    icon: Wallet,
    title: "Fund",
    actor: "INVESTOR",
    description: "Review the pool target and on-chain terms before choosing whether to contribute.",
  },
  {
    icon: Handshake,
    title: "Report & Settle",
    actor: "POOL PARTICIPANTS",
    description: "Pool activity is recorded on-chain; outcomes follow agreed terms.",
  },
];
export const securityPrinciples = [
  { icon: Network, text: "Solana-based transaction records" },
  { icon: LockKeyhole, text: "Controlled pool fund movements" },
  { icon: Users, text: "Multisig for sensitive operations" },
  { icon: FileCheck2, text: "Documented settlement approval" },
  { icon: BadgeCheck, text: "Business verification and monitoring" },
  { icon: ShieldCheck, text: "Clear investor risk disclosures" },
];
export const faqs = [
  {
    question: "What is MoonCreditFi?",
    answer:
      "A platform in development for connecting businesses and investors through Mudarabah financing. Initial focus: Ghana and Africa.",
  },
  {
    question: "What is Mudarabah?",
    answer:
      "A profit-sharing arrangement: investors provide capital and entrepreneurs manage the business. Returns are not fixed or guaranteed.",
  },
  {
    question: "How do investors participate?",
    answer:
      "Review a business, proposal and risks before contributing under disclosed terms. Opportunities and wallet connections are not live yet.",
  },
  {
    question: "How are profits distributed?",
    answer:
      "Verified profits follow the agreed pool terms after reporting and settlement approval.",
  },
  {
    question: "What if a business makes a loss?",
    answer:
      "Losses follow the agreed Mudarabah terms and applicable law. Investors may lose some or all of their capital.",
  },
  {
    question: "How are businesses reviewed?",
    answer:
      "Reviews are intended to consider business details, documents and reputation signals. None guarantees success or repayment.",
  },
  {
    question: "How does MoonCreditFi use Solana?",
    answer:
      "Solana is planned for pool contributions and transaction records. No live smart contract is deployed on this site.",
  },
  {
    question: "Are returns guaranteed?",
    answer:
      "No. Business, market and technical risks can cause capital loss. Review all terms before investing.",
  },
];
