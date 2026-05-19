const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const http = require("http");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "db.json");

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

function getNum(v) {
  return Number(v || 0);
}

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    return { users: [], reports: [], inputs: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return { users: [], reports: [], inputs: [] };
  }
}

function writeDb(next) {
  fs.writeFileSync(DB_PATH, JSON.stringify(next, null, 2));
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

  const valuationLow = Math.max(0, baseMin * commonMultiplier);
  const valuationMedian = Math.max(0, baseMedian * commonMultiplier);
  const valuationHigh = Math.max(0, baseMax * commonMultiplier);

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
    valuationLow,
    valuationMedian,
    valuationHigh,
    confidence,
    impact: {
      revenueImpact,
      growthImpact,
      marketImpact,
      teamImpact,
    },
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function serveStatic(req, res) {
  let pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (pathname === "/") pathname = "/index.html";
  const targetPath = path.normalize(path.join(__dirname, pathname));
  if (!targetPath.startsWith(__dirname)) {
    sendJson(res, 403, { ok: false, message: "Forbidden" });
    return;
  }
  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
    sendJson(res, 404, { ok: false, message: "Not found" });
    return;
  }
  const ext = path.extname(targetPath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  res.end(fs.readFileSync(targetPath));
}

const server = http.createServer(async (req, res) => {
  const { method } = req;
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

  try {
    if (method === "POST" && pathname === "/api/auth") {
      const payload = await getBody(req);
      const db = readDb();
      const user = { ...payload, id: randomUUID(), createdAt: new Date().toISOString() };
      db.users.push(user);
      writeDb(db);
      sendJson(res, 200, { ok: true, user });
      return;
    }

    if (method === "POST" && pathname === "/api/valuate") {
      const input = await getBody(req);
      const output = calculateValuation(input);
      const db = readDb();
      db.inputs.push({ id: randomUUID(), input, createdAt: new Date().toISOString() });
      writeDb(db);
      sendJson(res, 200, { ok: true, output });
      return;
    }

    if (method === "GET" && pathname === "/api/reports") {
      const db = readDb();
      sendJson(res, 200, { ok: true, reports: db.reports });
      return;
    }

    if (method === "POST" && pathname === "/api/reports") {
      const payload = await getBody(req);
      const db = readDb();
      const report = { ...payload, id: randomUUID(), createdAt: new Date().toISOString() };
      db.reports.unshift(report);
      writeDb(db);
      sendJson(res, 200, { ok: true, report });
      return;
    }

    serveStatic(req, res);
  } catch {
    sendJson(res, 500, { ok: false, message: "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`PoyoX Financials running at http://localhost:${PORT}`);
});
