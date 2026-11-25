import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Wallet,
  BriefcaseBusiness,
  Mail,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { steps } from "./mooncredit-content";
export type Panel =
  "wallet" | "opportunities" | "entrepreneur" | "demo" | "contact" | "privacy" | "terms";
const titles: Record<Panel, string> = {
  wallet: "Connect your wallet",
  opportunities: "Explore opportunities",
  entrepreneur: "Bring your business forward",
  demo: "From trust to opportunity",
  contact: "Contact MoonCreditFi",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
};
const descriptions: Record<Panel, string> = {
  wallet: "Wallet access is not configured yet.",
  opportunities: "Transparent terms. Real businesses. Informed decisions.",
  entrepreneur: "An ethical path to business financing.",
  demo: "An illustrative walkthrough of the intended financing process.",
  contact: "Let’s start a conversation.",
  privacy: "Privacy documentation is pending publication.",
  terms: "Platform terms are pending publication.",
};
export function MoonCreditDialog({ panel, onClose }: { panel: Panel | null; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = steps[step];
  return (
    <Dialog
      open={panel !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setStep(0);
        }
      }}
    >
      <DialogContent className="max-w-[calc(100%-32px)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl leading-relaxed">
            {panel ? titles[panel] : ""}
          </DialogTitle>
          <DialogDescription>{panel ? descriptions[panel] : ""}</DialogDescription>
        </DialogHeader>
        <div className="dialog-body">
          {panel === "wallet" && (
            <div className="dialog-notice">
              <Wallet size={27} />
              <p>
                No wallet provider is connected to this site. Solana wallet access will become
                available when the platform’s integration is ready.
              </p>
              <p className="mt-3">
                No connection or transaction has been initiated. Never share your seed phrase.
              </p>
            </div>
          )}
          {panel === "opportunities" && (
            <div className="dialog-notice">
              <BriefcaseBusiness size={27} />
              <h3 className="text-foreground font-semibold mb-2">
                No investment pools available yet
              </h3>
              <p>
                There are no live opportunities to browse on this website. Business profiles,
                disclosed pool terms and risk information will be available before participation
                opens.
              </p>
            </div>
          )}
          {panel === "entrepreneur" && (
            <div className="dialog-notice">
              <BriefcaseBusiness size={27} />
              <h3 className="text-foreground font-semibold mb-2">Applications are not open yet</h3>
              <p>
                The intended application process includes a business profile, a financing proposal
                and supporting documentation. No application or personal information is collected by
                this page.
              </p>
            </div>
          )}
          {panel === "demo" && current && (
            <>
              <div className="demo-progress">
                {steps.map((item, i) => (
                  <span key={item.title} className={i <= step ? "current" : ""} />
                ))}
              </div>
              <div className="demo-step">
                <div className="icon-tile">
                  <current.icon />
                </div>
                <h3>
                  {String(step + 1).padStart(2, "0")}. {current.title}
                </h3>
                <p>{current.description}</p>
              </div>
              <div className="flex justify-between gap-3">
                <Button
                  variant="quiet"
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  <ArrowLeft /> Back
                </Button>
                <Button
                  variant="gold"
                  onClick={() => (step === steps.length - 1 ? onClose() : setStep((s) => s + 1))}
                >
                  {step === steps.length - 1 ? "Finish" : "Next"}
                  <ArrowRight />
                </Button>
              </div>
              <p className="mt-5 text-xs">
                Product concept only. No live pools, transactions or actual financial performance
                are shown.
              </p>
            </>
          )}
          {panel === "contact" && (
            <div className="dialog-notice">
              <Mail size={27} />
              <p>
                An official contact address has not been published yet. Please check back for
                MoonCreditFi’s verified contact details.
              </p>
            </div>
          )}
          {(panel === "privacy" || panel === "terms") && (
            <div className="dialog-notice">
              <FileText size={27} />
              <p>
                {panel === "privacy"
                  ? "The official privacy policy has not been provided yet. This page does not offer account creation, accept applications or collect form submissions. Do not submit sensitive personal or financial information."
                  : "Official investment and platform terms have not been provided yet. This website is informational and does not accept investments. Any future participation will require the applicable pool terms, eligibility criteria and risk disclosures."}
              </p>
              <p className="mt-3 flex items-start gap-2">
                <CircleAlert className="shrink-0 mt-1" size={15} />
                This is not investment advice or a guarantee of returns.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
