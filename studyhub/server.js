const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// permitir arquivos do site
app.use(express.static(path.join(__dirname)));

// abrir o site
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});