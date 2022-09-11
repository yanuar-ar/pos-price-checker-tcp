/// watch sku.csv
/// Device: Scantech SG

const figlet = require("figlet");
const Net = require("net");
const watch = require("node-watch");
const fs = require("fs");
const parse = require("csv-parse/lib/sync");
const _ = require("lodash");
const port = 9101;

const server = new Net.Server();

let skuData = [];

// print logo
figlet("PRICE CHECKER", function (err, data) {
  if (err) {
    console.log("Something wrong");
    console.dir(err);
    return;
  }
  console.log(data);
});

// ============================ FUNCTIONS =========================
// load sku.csv to memory (skuData array)
async function readCSV() {
  const dataFile = fs.readFileSync("sku.csv", "utf8");
  skuData = parse(dataFile, { delimiter: ";", columns: true });
  console.log("SKU file is changing. Updating the SKU for price checker.");
}

function chr(...x) {
  return String.fromCharCode(...x);
}

// find SKU in sku.csv
async function findSKU(barcode) {
  const data = _.find(skuData, { barcode: barcode });
  return data;
}

// =======================================================

// get CSV first
readCSV();

// ================= WATCH SKU.csv =========================
// watch SKU.csv in realtime
watch("sku.csv", async function (event, filename) {
  readCSV();
});

// ============================== TCP SERVER =========================
server.listen(port, function () {
  console.log(`Server uses port: ${port}`);
});

server.on("connection", function (socket) {
  console.log("Connected");

  socket.on("data", async function (chunk) {
    // read Barcode sent by Price Checker
    // remember this is TCP connection so be careful for chunked data
    const chunkData = chunk.toString();
    const chunkLength = chunkData.length;
    const barcode = chunkData.substring(1, chunkLength - 1);

    // find SKU
    const sku = await findSKU(barcode);

    // if no SKU detected
    if (sku == null) {
      socket.write(chr(27, 66, 49)); // font 1
      socket.write(chr(27, 37)); // clear
      socket.write(chr(27, 46, 49)); // align center
      socket.write("NOT");
      socket.write(chr(3));
      socket.write(chr(27, 46, 52)); // align center
      socket.write("FOUND");
      socket.write(chr(3));
      console.log(`${barcode} =>> Not found !!`);
      return;
    }

    console.log(`${barcode} =>> Found : ${sku.name}`);
    socket.write(chr(27, 66, 48)); // font 0
    socket.write(chr(27, 37)); // clear
    socket.write(sku.name);
    socket.write(chr(13));

    if (sku.qty1 > 0) {
      socket.write(`>=${sku.qty1} : Rp${sku.price1}`);
      socket.write(chr(13));
    }

    if (sku.qty2 > 0) {
      socket.write(`>=${sku.qty2} : Rp${sku.price2}`);
      socket.write(chr(13));
    }

    // pack Unit of Measure
    if (sku.packuom !== "") {
      socket.write(`DUS : Rp${sku.packprice}`);
      socket.write(chr(13));
    }

    socket.write(chr(27, 66, 49)); // font 1
    socket.write(chr(27, 46, 56));
    socket.write("Rp" + sku.retailprice.toString());
    socket.write(chr(3));
  });

  socket.on("end", function () {
    console.log("Connection is ended.");
  });

  socket.on("error", function (err) {
    console.log(`Error: ${err}`);
  });
});
