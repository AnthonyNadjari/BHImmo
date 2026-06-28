/**
 * Interactive investment / financing simulator for the property detail page.
 * Mortgage amortization + cashflow + cash-on-cash return, recomputed live.
 */

import { useMemo, useState } from "react";
import type { Property } from "../types";
import { formatEuro } from "../services/format";
import "../investment.css";

/** Standard fixed-rate amortization. M = L·r / (1 − (1+r)^−n). Guards r = 0. */
function monthlyPayment(loan: number, monthlyRate: number, months: number): number {
  if (months <= 0) return 0;
  if (monthlyRate === 0) return loan / months;
  return (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

function formatPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit: string;
  /** Format the readout value (defaults to the raw number). */
  format?: (v: number) => string;
}

function Slider({ label, value, min, max, step, onChange, unit, format }: SliderProps) {
  const readout = format ? format(value) : String(value);
  return (
    <label className="invsim-control">
      <span className="invsim-control-head">
        <span className="invsim-control-label">{label}</span>
        <span className="invsim-control-readout">
          {readout}
          {unit && <i className="invsim-unit">{unit}</i>}
        </span>
      </span>
      <input
        type="range"
        className="invsim-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Output({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
  big?: boolean;
}) {
  return (
    <div className={`invsim-out ${big ? "is-big" : ""}`}>
      <span className="invsim-out-label">{label}</span>
      <span className={`invsim-out-value ${tone ? `tone-${tone}` : ""}`}>{value}</span>
    </div>
  );
}

export function InvestmentCalculator({ property }: { property: Property }) {
  const price = property.pricing.current_price;
  const defaultRent = Math.round(property.rent.monthly_est);

  const [downPct, setDownPct] = useState(20);
  const [ratePct, setRatePct] = useState(3.5);
  const [termYears, setTermYears] = useState(20);
  const [feesPct, setFeesPct] = useState(8);
  const [rent, setRent] = useState(defaultRent);
  const [charges, setCharges] = useState(Math.round(defaultRent * 0.1));

  const m = useMemo(() => {
    const fees = price * (feesPct / 100);
    const totalProjectCost = price + fees;
    const downPayment = price * (downPct / 100);
    const loan = Math.max(0, price - downPayment);
    const cashInvested = downPayment + fees;

    const monthlyRate = ratePct / 100 / 12;
    const months = termYears * 12;
    const mortgage = monthlyPayment(loan, monthlyRate, months);

    const monthlyCashflow = rent - mortgage - charges;
    const annualCashflow = monthlyCashflow * 12;
    const cashOnCash = cashInvested > 0 ? (annualCashflow / cashInvested) * 100 : 0;

    const grossYield = price > 0 ? ((rent * 12) / price) * 100 : 0;
    // Net of operating charges/management, before mortgage interest.
    const netYield = price > 0 ? (((rent - charges) * 12) / price) * 100 : 0;

    return {
      fees,
      totalProjectCost,
      downPayment,
      loan,
      cashInvested,
      mortgage,
      monthlyCashflow,
      annualCashflow,
      cashOnCash,
      grossYield,
      netYield,
    };
  }, [price, downPct, ratePct, termYears, feesPct, rent, charges]);

  const cfTone: "good" | "bad" = m.monthlyCashflow >= 0 ? "good" : "bad";

  return (
    <div className="card span-2 invsim">
      <h2>Investment simulator</h2>

      <div className="invsim-grid">
        {/* Controls */}
        <div className="invsim-controls">
          <Slider
            label="Down payment"
            value={downPct}
            min={0}
            max={60}
            step={1}
            unit="%"
            onChange={setDownPct}
          />
          <Slider
            label="Interest rate"
            value={ratePct}
            min={0}
            max={8}
            step={0.1}
            unit="%"
            format={(v) => v.toFixed(1)}
            onChange={setRatePct}
          />
          <Slider
            label="Loan term"
            value={termYears}
            min={5}
            max={30}
            step={1}
            unit="yrs"
            onChange={setTermYears}
          />
          <Slider
            label="Notary / agency fees"
            value={feesPct}
            min={0}
            max={15}
            step={0.5}
            unit="%"
            format={(v) => v.toFixed(1)}
            onChange={setFeesPct}
          />
          <Slider
            label="Monthly rent"
            value={rent}
            min={0}
            max={Math.max(defaultRent * 2, 4000)}
            step={10}
            unit="€"
            format={(v) => formatEuro(v)}
            onChange={setRent}
          />
          <Slider
            label="Charges / management"
            value={charges}
            min={0}
            max={Math.max(Math.round(defaultRent * 0.6), 600)}
            step={10}
            unit="€"
            format={(v) => formatEuro(v)}
            onChange={setCharges}
          />
        </div>

        {/* Results */}
        <div className="invsim-results">
          <div className="invsim-headline">
            <Output
              label="Monthly cashflow"
              value={formatEuro(Math.round(m.monthlyCashflow))}
              tone={cfTone}
              big
            />
            <Output
              label="Cash-on-cash return"
              value={formatPct(m.cashOnCash)}
              tone={m.cashOnCash >= 0 ? "good" : "bad"}
              big
            />
          </div>

          <div className="invsim-out-grid">
            <Output label="Total project cost" value={formatEuro(Math.round(m.totalProjectCost))} />
            <Output label="Down payment" value={formatEuro(Math.round(m.downPayment))} />
            <Output label="Loan amount" value={formatEuro(Math.round(m.loan))} />
            <Output label="Fees" value={formatEuro(Math.round(m.fees))} />
            <Output
              label="Monthly mortgage"
              value={formatEuro(Math.round(m.mortgage))}
            />
            <Output
              label="Annual cashflow"
              value={formatEuro(Math.round(m.annualCashflow))}
              tone={cfTone}
            />
            <Output label="Gross yield" value={formatPct(m.grossYield)} />
            <Output label="Net yield" value={formatPct(m.netYield)} />
          </div>

          <p className="invsim-note">
            Listing reference yields — gross {formatPct(property.investment.gross_yield)},
            net {formatPct(property.investment.net_yield)}. Estimates only; excludes taxes,
            vacancy and insurance.
          </p>
        </div>
      </div>
    </div>
  );
}
