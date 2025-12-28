const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
app.use(bodyParser.json());
app.use(cors());

const db = new sqlite3.Database("./pix.db");

db.run(`
CREATE TABLE IF NOT EXISTS pagamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mp_id TEXT,
  status TEXT,
  valor REAL
)
`);

const MP_TOKEN = process.env.MP_TOKEN;

// =======================
// CRIAR PIX
// =======================
app.post("/pix/criar", async (req, res) => {
  const { valor, descricao } = req.body;

  try {
    const response = await axios.post(
      "https://api.mercadopago.com/v1/payments",
      {
        transaction_amount: Number(valor),
        description: descricao,
        payment_method_id: "pix",
        payer: { email: "cliente@pix.com" }
      },
      {
        headers: {
          Authorization: `Bearer ${MP_TOKEN}`
        }
      }
    );

    const pix = response.data;

    db.run(
      "INSERT INTO pagamentos (mp_id, status, valor) VALUES (?, ?, ?)",
      [pix.id, pix.status, valor]
    );

    res.json({
      id: pix.id,
      qr_code: pix.point_of_interaction.transaction_data.qr_code,
      qr_code_base64:
        pix.point_of_interaction.transaction_data.qr_code_base64
    });
  } catch (e) {
    res.status(500).json({ erro: "Erro ao criar Pix" });
  }
});

// =======================
// CONSULTAR STATUS
// =======================
app.get("/pix/status/:id", (req, res) => {
  db.get(
    "SELECT status FROM pagamentos WHERE mp_id = ?",
    [req.params.id],
    (err, row) => {
      if (!row) return res.json({ status: "nao_encontrado" });
      res.json({ status: row.status });
    }
  );
});

// =======================
// WEBHOOK
// =======================
app.post("/webhook", async (req, res) => {
  if (req.body.type === "payment") {
    const id = req.body.data.id;

    const resp = await axios.get(
      `https://api.mercadopago.com/v1/payments/${id}`,
      {
        headers: { Authorization: `Bearer ${MP_TOKEN}` }
      }
    );

    db.run(
      "UPDATE pagamentos SET status = ? WHERE mp_id = ?",
      [resp.data.status, id]
    );
  }

  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () =>
  console.log("API Pix rodando")
);