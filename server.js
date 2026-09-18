const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

function startServer() {
  return app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`Cabal Online Task List Overlay rodando com sucesso!`);
    console.log(`Acesse no OBS Browser Source: http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
