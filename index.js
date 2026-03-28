const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "*" }));
app.use(express.json());

const META_BASE = "https://graph.facebook.com/v19.0";

// Rota: buscar campanhas com insights
app.get("/campaigns", async (req, res) => {
  const { token, account_id } = req.query;
  if (!token || !account_id) return res.status(400).json({ error: "token e account_id são obrigatórios" });

  try {
    const accountId = account_id.startsWith("act_") ? account_id : `act_${account_id}`;
    const fields = "id,name,status,daily_budget,lifetime_budget";
    const campRes = await fetch(`${META_BASE}/${accountId}/campaigns?fields=${fields}&limit=50&access_token=${token}`);
    const campData = await campRes.json();
    if (campData.error) return res.status(400).json({ error: campData.error.message });

    const campaigns = campData.data || [];

    const withInsights = await Promise.all(campaigns.map(async c => {
      try {
        const insRes = await fetch(`${META_BASE}/${c.id}/insights?fields=spend,impressions,clicks,actions,action_values&date_preset=last_30d&access_token=${token}`);
        const insData = await insRes.json();
        const insight = insData.data?.[0] || {};
        const spend = parseFloat(insight.spend || 0);
        const impressions = parseInt(insight.impressions || 0);
        const clicks = parseInt(insight.clicks || 0);
        const actions = insight.actions || [];
        const actionValues = insight.action_values || [];
        const conversions = parseInt(actions.find(a => a.action_type === "purchase")?.value || 0);
        const revenue = parseFloat(actionValues.find(a => a.action_type === "purchase")?.value || 0);
        const budget = parseFloat(c.daily_budget || c.lifetime_budget || 0) / 100;
        return { id: c.id, name: c.name, status: c.status, budget, spent: spend, impressions, clicks, conversions, revenue };
      } catch {
        return { id: c.id, name: c.name, status: c.status, budget: 0, spent: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
      }
    }));

    res.json({ data: withInsights });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Rota: info da conta
app.get("/account", async (req, res) => {
  const { token, account_id } = req.query;
  if (!token || !account_id) return res.status(400).json({ error: "token e account_id são obrigatórios" });

  try {
    const accountId = account_id.startsWith("act_") ? account_id : `act_${account_id}`;
    const r = await fetch(`${META_BASE}/${accountId}?fields=name,currency,account_status,amount_spent&access_token=${token}`);
    const data = await r.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/health", (_, res) => res.json({ status: "ok" }));

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
