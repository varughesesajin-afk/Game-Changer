const path = require("path");
const miniweb = require("./lib/miniweb");
const { PORT } = require("./lib/config");

const publicApi = require("./routes/public");
const adminApi = require("./routes/admin");

const app = miniweb.createApp();

app.use(miniweb.json());
app.use(miniweb.session({ maxAge: 1000 * 60 * 60 * 12 }));

app.use("/api/admin", adminApi);
app.use("/api", publicApi);

app.serveStatic(path.join(__dirname, "public"));

app.listen(PORT, () => {
  console.log(`Games All Day running at http://localhost:${PORT}`);
});
