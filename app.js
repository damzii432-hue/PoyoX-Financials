const STORAGE_KEYS = {
  user: "poyox_user",
  reports: "poyox_reports",
  lastResult: "poyox_last_result",
};

const INDUSTRY_MULTIPLES = {
  SaaS: [5, 12],
  Marketplace: [3, 8],
  "E-commerce": [2, 5],
  Service: [1.5, 4],
  Other: [1.2, 3.2],
};

const EXPERIENCE_MULTIPLIER = {
  Beginner: 1.0,
  Intermediate: 1.12,
  Expert: 1.25,
};

const COMPETITION_FACTOR = {
  Low: 1.06,
  Medium: 0.96,
  High: 0.82,
};

const pages = {
  landing: document.getElementById("landing-page"),
  auth: document.getElementById("auth-page"),
  form: document.getElementById("form-page"),
  results: document.getElementById("results-page"),
  dashboard: document.getElementById("dashboard-page"),
};

let latestComputation = null;

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json();
}

function showPage(pageKey) {
  Object.values(pages).forEach((p) => p.classList.remove("active"));
  pages[pageKey].classList.add("active");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getNum(v) {
  return Number(v || 0);
}

function calculateValuation(formData) {
  const annualRevenue = getNum(formData.annualRevenue);
  const monthlyGrowthRate = getNum(formData.monthlyGrowthRate);
  const customerGrowthRate = getNum(formData.customerGrowthRate);
  const profitMargin = getNum(formData.profitMargin);
  const burnRate = getNum(formData.burnRate);
  const activeUsers = getNum(formData.activeUsers);
  const teamSize = getNum(formData.teamSize);
  const marketSize = getNum(formData.marketSizeTAM);
  const scenarioGrowthDelta = getNum(formData.scenarioGrowthDelta);

  const [minMultiple, maxMultiple] =
    INDUSTRY_MULTIPLES[formData.industry] || INDUSTRY_MULTIPLES.Other;
  const medianMultiple = (minMultiple + maxMultiple) / 2;

  const adjustedGrowthRate = monthlyGrowthRate + scenarioGrowthDelta;
  const growthBoost = Math.max(-0.2, Math.min(0.5, adjustedGrowthRate / 100));
  const customerBoost = Math.max(-0.1, Math.min(0.2, customerGrowthRate / 300));
  const marginFactor = 1 + Math.max(-0.2, Math.min(0.2, profitMargin / 200));
  const burnPenalty =
    annualRevenue > 0 ? Math.max(0.7, 1 - burnRate / (annualRevenue / 6)) : 0.75;

  const teamBase =
    EXPERIENCE_MULTIPLIER[formData.founderExperienceLevel] || 1.0;
  const teamScale = Math.min(1.18, 1 + teamSize / 150);
  const exitsBoost = formData.previousExits === "Yes" ? 1.12 : 1.0;
  const teamMultiplier = teamBase * teamScale * exitsBoost;

  const marketFactorBase =
    COMPETITION_FACTOR[formData.competitionLevel] || COMPETITION_FACTOR.Medium;
  const marketSizeBoost = Math.min(1.2, 1 + marketSize / 1000000000);
  const marketFactor = marketFactorBase * marketSizeBoost;

  const userSignalBoost = Math.min(1.25, 1 + activeUsers / 250000);

  const baseMin = annualRevenue * minMultiple;
  const baseMedian = annualRevenue * medianMultiple;
  const baseMax = annualRevenue * maxMultiple;

  const growthFactor = 1 + growthBoost + customerBoost;
  const commonMultiplier =
    growthFactor * teamMultiplier * marketFactor * marginFactor * burnPenalty * userSignalBoost;

  const low = Math.max(0, baseMin * commonMultiplier);
  const median = Math.max(0, baseMedian * commonMultiplier);
  const high = Math.max(0, baseMax * commonMultiplier);

  const confidence = Math.max(
    55,
    Math.min(
      94,
      65 +
        (annualRevenue > 0 ? 7 : 0) +
        (activeUsers > 5000 ? 5 : 0) +
        (Math.abs(monthlyGrowthRate) < 40 ? 3 : 0) +
        (formData.competitionLevel === "Low" ? 3 : 0) +
        (formData.founderExperienceLevel === "Expert" ? 3 : 0)
    )
  );

  const revenueImpact = Math.round(
    Math.min(100, Math.max(0, (annualRevenue / 1000000) * 30 + 20))
  );
  const growthImpact = Math.round(
    Math.min(100, Math.max(0, adjustedGrowthRate * 1.5 + customerGrowthRate * 0.6 + 18))
  );
  const marketImpact = Math.round(
    Math.min(100, Math.max(0, (marketFactor - 0.6) * 60))
  );
  const teamImpact = Math.round(
    Math.min(100, Math.max(0, (teamMultiplier - 0.8) * 70))
  );

  return {
    valuationLow: low,
    valuationMedian: median,
    valuationHigh: high,
    confidence,
    impact: {
      revenueImpact,
      growthImpact,
      marketImpact,
      teamImpact,
    },
  };
}

function generateWeaknesses(data, results) {
  const weaknesses = [];
  if (getNum(data.monthlyGrowthRate) < 8) {
    weaknesses.push("Monthly growth is below high-growth startup benchmark (<8%).");
  }
  if (data.competitionLevel === "High") {
    weaknesses.push("High competition is compressing valuation multiple.");
  }
  if (getNum(data.profitMargin) < 0) {
    weaknesses.push("Negative profit margin reduces investor confidence.");
  }
  if (getNum(data.burnRate) > getNum(data.monthlyRevenue) * 1.3) {
    weaknesses.push("Burn rate materially exceeds monthly revenue.");
  }
  if (results.confidence < 70) {
    weaknesses.push("Confidence is lower due to volatile growth or missing signals.");
  }
  if (weaknesses.length === 0) {
    weaknesses.push("No critical weaknesses detected in current scenario.");
  }
  return weaknesses;
}

function generateInsights(data, results) {
  const insights = [];
  if (getNum(data.monthlyRevenue) > 0) {
    const increasedMrr = getNum(data.monthlyRevenue) * 1.2;
    const estimatedLift = Math.round((increasedMrr / getNum(data.monthlyRevenue) - 1) * 18);
    insights.push(
      `Increase MRR by 20% (to ${formatCurrency(
        increasedMrr
      )}) to potentially lift valuation by ~${estimatedLift}%+.`
    );
  }
  if (data.competitionLevel === "High") {
    insights.push("Differentiate positioning or niche focus to reduce competition pressure.");
  }
  if (data.founderExperienceLevel === "Expert" || data.previousExits === "Yes") {
    insights.push("Strong founding team profile positively impacts investor confidence.");
  } else {
    insights.push("Advisory board additions can increase team credibility in fundraising.");
  }
  if (getNum(data.customerGrowthRate) < 10) {
    insights.push("Improve customer acquisition channels to strengthen growth multiple.");
  }
  insights.push(
    `At current assumptions, median valuation is ${formatCurrency(
      results.valuationMedian
    )} with ${results.confidence}% confidence.`
  );
  return insights;
}

function renderList(targetId, items) {
  const ul = document.getElementById(targetId);
  ul.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    ul.appendChild(li);
  });
}

function renderResults(data, valuation) {
  const range = `${formatCurrency(valuation.valuationLow)} - ${formatCurrency(
    valuation.valuationHigh
  )}`;
  document.getElementById("valuation-range").textContent = range;
  document.getElementById("valuation-median").textContent = formatCurrency(
    valuation.valuationMedian
  );
  document.getElementById("confidence-score").textContent = `${valuation.confidence}%`;
  document.getElementById("revenue-impact").textContent = `${valuation.impact.revenueImpact}%`;
  document.getElementById("growth-impact").textContent = `${valuation.impact.growthImpact}%`;
  document.getElementById("market-impact").textContent = `${valuation.impact.marketImpact}%`;
  document.getElementById("team-impact").textContent = `${valuation.impact.teamImpact}%`;

  const weaknesses = generateWeaknesses(data, valuation);
  const insights = generateInsights(data, valuation);
  renderList("weakness-list", weaknesses);
  renderList("ai-insights-list", insights);

  latestComputation = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    input: data,
    output: valuation,
    weaknesses,
    insights,
  };
  localStorage.setItem(STORAGE_KEYS.lastResult, JSON.stringify(latestComputation));
}

function parseForm(form) {
  const data = {};
  new FormData(form).forEach((value, key) => {
    data[key] = value;
  });
  return data;
}

function getReports() {
  const raw = localStorage.getItem(STORAGE_KEYS.reports);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveReportLocal(report) {
  const reports = getReports();
  reports.unshift(report);
  localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(reports));
}

function renderDashboard(reports = getReports()) {
  const reportsList = document.getElementById("reports-list");
  reportsList.innerHTML = "";
  if (!reports.length) {
    reportsList.innerHTML = "<p class='muted'>No reports saved yet.</p>";
    return;
  }
  reports.forEach((report) => {
    const block = document.createElement("article");
    block.className = "report-item";
    block.innerHTML = `
      <h4>${report.input.companyName} - ${report.input.industry}</h4>
      <p><strong>Median:</strong> ${formatCurrency(report.output.valuationMedian)}</p>
      <p><strong>Range:</strong> ${formatCurrency(report.output.valuationLow)} - ${formatCurrency(
      report.output.valuationHigh
    )}</p>
      <p><strong>Confidence:</strong> ${report.output.confidence}%</p>
      <p class="muted"><strong>Date:</strong> ${new Date(
        report.createdAt
      ).toLocaleString()}</p>
    `;
    reportsList.appendChild(block);
  });
}

function handleExport() {
  if (!latestComputation) {
    setResultStatus("Run a valuation before export.");
    return;
  }
  window.print();
}

function setResultStatus(message) {
  document.getElementById("result-status").textContent = message;
}

function setupNavigation() {
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const page = button.getAttribute("data-nav");
      if (page === "dashboard") preloadReports();
      showPage(page);
    });
  });
}

function setupScenarioSlider() {
  const slider = document.querySelector("input[name='scenarioGrowthDelta']");
  const output = document.getElementById("scenario-output");
  slider.addEventListener("input", () => {
    output.textContent = `${slider.value}%`;
  });
}

function setupAuth() {
  const authForm = document.getElementById("auth-form");
  const authStatus = document.getElementById("auth-status");
  const googleBtn = document.getElementById("google-signin-btn");
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = parseForm(authForm);
    try {
      const result = await apiRequest("/api/auth", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(result.user));
      authStatus.textContent = `Welcome ${result.user.fullName}. Email authentication complete.`;
    } catch {
      payload.createdAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(payload));
      authStatus.textContent = `Welcome ${payload.fullName}. Saved locally (offline mode).`;
    }
  });
  googleBtn.addEventListener("click", () => {
    authStatus.textContent =
      "Google sign-in is optional and ready for backend OAuth integration.";
  });
}

function setupCountryCombobox() {
  const root = document.getElementById("country-combobox");
  if (!root) return;

  const select = document.getElementById("country-market-select");
  const search = document.getElementById("country-market-search");
  const list = document.getElementById("country-market-listbox");
  const toggle = root.querySelector(".country-combobox__toggle");
  const form = document.getElementById("valuation-form");

  const countries = Array.from(select.options)
    .filter((opt) => opt.value)
    .map((opt) => ({ value: opt.value, label: opt.textContent.trim() }));

  let open = false;
  let activeIndex = -1;
  let filtered = countries;

  function setOpen(next) {
    open = next;
    list.hidden = !open;
    search.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) activeIndex = -1;
    renderList();
  }

  function syncSearchFromSelect() {
    const opt = select.selectedOptions[0];
    if (opt && opt.value) {
      search.value = opt.textContent.trim();
    } else {
      search.value = "";
    }
  }

  function filter(query) {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) => c.label.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)
    );
  }

  function renderList() {
    list.innerHTML = "";
    if (!open) return;

    filtered.forEach((c, i) => {
      const li = document.createElement("li");
      li.className = "country-combobox__option";
      if (i === activeIndex) li.classList.add("country-combobox__option--active");
      li.setAttribute("role", "option");
      li.setAttribute("data-value", c.value);
      li.textContent = c.label;
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectCountry(c);
      });
      list.appendChild(li);
    });

    if (filtered.length === 0) {
      const empty = document.createElement("li");
      empty.className = "country-combobox__option country-combobox__option--empty";
      empty.setAttribute("role", "presentation");
      empty.textContent = "No matches. Try another spelling.";
      list.appendChild(empty);
    }
  }

  function scrollActiveIntoView() {
    const el = list.querySelector(".country-combobox__option--active");
    if (el) el.scrollIntoView({ block: "nearest" });
  }

  function selectCountry(c) {
    select.value = c.value;
    search.value = c.label;
    setOpen(false);
    search.focus();
  }

  function openList() {
    filtered = filter(search.value);
    activeIndex = filtered.length > 0 ? 0 : -1;
    setOpen(true);
  }

  search.addEventListener("focus", () => {
    openList();
  });

  search.addEventListener("input", () => {
    openList();
  });

  search.addEventListener("blur", () => {
    window.setTimeout(() => {
      if (root.contains(document.activeElement)) return;
      setOpen(false);
      const exact = countries.find(
        (c) => c.label.toLowerCase() === search.value.trim().toLowerCase()
      );
      if (exact) selectCountry(exact);
      else syncSearchFromSelect();
    }, 180);
  });

  search.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openList();
      if (filtered.length === 0) return;
      activeIndex = Math.min(filtered.length - 1, activeIndex + 1);
      renderList();
      scrollActiveIntoView();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) openList();
      if (filtered.length === 0) return;
      activeIndex = Math.max(0, activeIndex - 1);
      renderList();
      scrollActiveIntoView();
    } else if (e.key === "Enter") {
      if (open && activeIndex >= 0 && filtered[activeIndex]) {
        e.preventDefault();
        selectCountry(filtered[activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      syncSearchFromSelect();
    }
  });

  toggle.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });

  toggle.addEventListener("click", () => {
    if (open) {
      setOpen(false);
    } else {
      search.focus();
      openList();
    }
  });

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) setOpen(false);
  });

  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      syncSearchFromSelect();
      setOpen(false);
    }, 0);
  });

  syncSearchFromSelect();
}

function setupValuationForm() {
  const form = document.getElementById("valuation-form");
  const resetBtn = document.getElementById("reset-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = parseForm(form);
    let valuation;
    try {
      const result = await apiRequest("/api/valuate", {
        method: "POST",
        body: JSON.stringify(data),
      });
      valuation = result.output;
    } catch {
      valuation = calculateValuation(data);
    }
    renderResults(data, valuation);
    showPage("results");
    setResultStatus("Valuation completed successfully.");
  });

  resetBtn.addEventListener("click", () => {
    form.reset();
    document.getElementById("scenario-output").textContent = "0%";
  });

  setupCountryCombobox();
}

function setupResultActions() {
  document.getElementById("save-report-btn").addEventListener("click", async () => {
    if (!latestComputation) {
      setResultStatus("Run a valuation before saving.");
      return;
    }
    try {
      await apiRequest("/api/reports", {
        method: "POST",
        body: JSON.stringify(latestComputation),
      });
      setResultStatus("Report saved to dashboard.");
    } catch {
      saveReportLocal(latestComputation);
      setResultStatus("Report saved locally (offline mode).");
    }
  });

  document.getElementById("export-pdf-btn").addEventListener("click", handleExport);

  document.getElementById("share-link-btn").addEventListener("click", async () => {
    if (!latestComputation) {
      setResultStatus("Run a valuation before sharing.");
      return;
    }
    const payload = btoa(JSON.stringify(latestComputation.output));
    const shareUrl = `${location.origin}${location.pathname}#report=${payload}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setResultStatus("Share link copied to clipboard.");
    } catch {
      setResultStatus(`Share link: ${shareUrl}`);
    }
  });
}

function restoreLastResult() {
  const raw = localStorage.getItem(STORAGE_KEYS.lastResult);
  if (!raw) return;
  try {
    latestComputation = JSON.parse(raw);
  } catch {
    latestComputation = null;
  }
}

async function preloadReports() {
  try {
    const result = await apiRequest("/api/reports");
    renderDashboard(result.reports || []);
  } catch {
    renderDashboard();
  }
}

function init() {
  setupNavigation();
  setupScenarioSlider();
  setupAuth();
  setupValuationForm();
  setupResultActions();
  restoreLastResult();
  preloadReports();
  showPage("landing");
}

init();
