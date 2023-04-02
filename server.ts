import http from "http";
import https from "https";
import url from "url";
import fs from "fs";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";

// config
dotenv.config({ path: ".env" });
const app = express();
const connectionString: any = process.env.connectionString;
const DBNAME = "MongoDB_Esercizi";
const HTTP_PORT = 1337;
const HTTPS_PORT = 1338;
const privateKey = fs.readFileSync("keys/privateKey.pem", "utf8");
const certificate = fs.readFileSync("keys/certificate.crt", "utf8");
const credentials = { key: privateKey, cert: certificate };

// const allowedOrigins = [
//   'capacitor://localhost',
//   'ionic://localhost',
//   'http://localhost',
//   'http://localhost:8080',
//   'http://localhost:8100',
// ];

// // Reflect the origin if it's in the allowed list or not defined (cURL, Postman, etc.)
// const corsOptions = {
//   origin: (origin:any, callback:any) => {
//     if (allowedOrigins.includes(origin) || !origin) {
//       callback(null, true);
//     } else {
//       callback(new Error('Origin not allowed by CORS'));
//     }
//   },
// };
// const whitelist = [
//   "http://my-crud-server.herokuapp.com ", //inserire il nostro sito pubblicato su render/heroku
//   "https://my-crud-server.herokuapp.com ",
//   "https://crud-server-fiorentino.onrender.com/",
//   "http://localhost:1337",
//   "https://localhost:1338",
//   "https://192.168.1.33:1338/api/",
//   "http://192.168.1.33:1337/api/",
//   "https://192.168.1.33:1338",
//   "http://192.168.1.33:1337",
//   "https://10.88.206.65:1338",
//   "http://10.88.206.65:1337",
//   "https://cordovaapp",
//   "http://localhost:4200",
//   'capacitor://localhost',
//   'ionic://localhost',
//   'http://localhost',
//   'http://localhost:8080',
//   'http://localhost:8100',
// ];

// const corsOptions = {
//   origin: function (origin: any, callback: any) {
//     if (!origin) return callback(null, true);
//     if (whitelist.indexOf(origin) === -1) {
//       var msg = `The CORS policy for this site does not  allow access from the specified Origin.`;
//       return callback(new Error(msg), false);
//     } else return callback(null, true);
//   },
//   credentials: true,
// };

let paginaErrore: string = "";

/* ****************** Creazione ed Avvio del Server ************************ */
let httpServer = http.createServer(app);
httpServer.listen(HTTP_PORT, "0.0.0.0", () => {
    init();
});

let httpsServer = https.createServer(credentials, app);
httpsServer.listen(HTTPS_PORT,"0.0.0.0", function(){
	console.log("Server in ascolto sulle porte HTTP:" + HTTP_PORT + ", HTTPS:" + HTTPS_PORT);
});

function init() {
  fs.readFile("./static/error.html", (err: any, data: any) => {
    if (err) {
      paginaErrore = "<h2>Risorsa non trovata</h2>";
    } else {
      paginaErrore = data.toString();
    }
  });
}

/***********MIDDLEWARE****************/
// 1 request log
app.use("/", (req: any, res: any, next: any) => {
  console.log(req.method + ": " + req.originalUrl);
  next();
});

// 2 gestione delle risorse statiche
//cerca le risorse nella cartella segnata nel path e li restituisce
app.use("/", express.static("./static"));

// 3 lettura dei parametri POST
app.use("/", express.json({ limit: "50mb" }));
app.use("/", express.urlencoded({ limit: "50mb", extended: true }));

// 4 log dei parametri get e post
app.use("/", (req: any, res: any, next: any) => {
  // parametri get .query, post .body
  if (Object.keys(req.query).length != 0) {
    console.log("---> Parametri GET: " + JSON.stringify(req.query));
  }
  if (Object.keys(req.body).length != 0) {
    console.log("---> Parametri BODY: " + JSON.stringify(req.body));
  }
  next();
});

// 5 Upload dei file binari
app.use("/", fileUpload({ limits: { fileSize: 20 * 1024 * 1024 } })); // 20 MB

const corsOptions = {
  origin: function(origin:any, callback:any) {
  return callback(null, true);
  },
  credentials: true
 };
 app.use("/", cors(corsOptions));


// Apertura della connessione
app.use("/api/", (req: any, res: any, next: any) => {
  let connection = new MongoClient(connectionString);
  connection
    .connect()
    .catch((err: any) => {
      res.status(503);
      res.send("Errore di connessione al DB");
    })
    .then((client: any) => {
      req["client"] = client;
      next();
    });
});

/***********USER LISTENER****************/
app.get("/api/getCollections", (req: any, res: any, next: any) => {
  let db = req.client.db(DBNAME);
  // Leggo tutte le collezioni del DB
  db.listCollections().toArray((err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore lettura connesioni");
    } else {
      res.send(data);
    }
    req.client.close();
  });
});

app.get(
  "/api/richiestaParams/:gender/:hair",
  (req: any, res: any, next: any) => {
    let gender = req.params.gender;
    let hair = req.params.hair;

    let collection = req.client.db(DBNAME).collection("Unicorn");
    collection.find({ gender, hair }).toArray((err: any, data: any) => {
      if (err) {
        res.status(500);
        res.send("Errore esecuzione query");
      } else {
        res.send(data);
      }
      req.client.close();
    });
  }
);

app.get("/api/:collection", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let param = req.query;

  let collection = req.client.db(DBNAME).collection(collectionSelected);
  collection.find(param).toArray((err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      // let response = [];
      // for (const item of data) {
      //   let key = Object.keys(item)[1];
      //   response.push({ _id: item["_id"], val: item[key] });
      // }
      res.send(data);
    }
    req.client.close();
  });
});

app.get("/api/:collection/:id", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let id = new ObjectId(req.params.id);

  let collection = req.client.db(DBNAME).collection(collectionSelected);
  collection.findOne({ _id: id }, (err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send(data);
    }
    req.client.close();
  });
});

app.delete("/api/:collection/:id", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let id = new ObjectId(req.params.id);

  let collection = req.client.db(DBNAME).collection(collectionSelected);
  collection.deleteOne({ _id: id }, (err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send(data);
    }
    req.client.close();
  });
});

app.patch("/api/:collection/:id", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let id = new ObjectId(req.params.id);

  let collection = req.client.db(DBNAME).collection(collectionSelected);
  collection.updateOne(
    { _id: id },
    { $set: req.body.stream },
    (err: any, data: any) => {
      if (err) {
        res.status(500);
        res.send("Errore esecuzione query");
      } else {
        res.send(data);
      }
      req.client.close();
    }
  );
});

app.put("/api/:collection/:id", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let id = new ObjectId(req.params.id);

  let collection = req.client.db(DBNAME).collection(collectionSelected);
  collection.replaceOne({ _id: id }, req.body.stream, (err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send(data);
    }
    req.client.close();
  });
});

app.post("/api/:collection", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let params = req.body.stream;

  let collection = req.client.db(DBNAME).collection(collectionSelected);
  collection.insertOne(params, (err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send(data);
    }
    req.client.close();
  });
});

//generic route type post for getting items of a collection with parameters for filtering
app.post("/api/:collection/getItems", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let params = req.body.stream;
  let collection = req.client.db(DBNAME).collection(collectionSelected);
  collection.find(params).toArray((err: any, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send(data);
    }
    req.client.close();
  });
});

app.post("/api/:collection/limit", (req: any, res: any, next: any) => {
  let collectionSelected = req.params.collection;
  let params = req.body.stream;
  let collection = req.client.db(DBNAME).collection(collectionSelected);
  collection
    .find(params)
    .limit(2)
    .toArray((err: any, data: any) => {
      if (err) {
        res.status(500);
        res.send("Errore esecuzione query");
      } else {
        res.send(data);
      }
      req.client.close();
    }
  );
});

/***********DEFAULT ROUTE****************/

app.use("/", (req: any, res: any, next: any) => {
  res.status(404);
  if (req.originalUrl.startsWith("/api/")) {
    res.send("API non disponibile");
    req.client.close();
  } else {
    res.send(paginaErrore);
  }
});

app.use("/", (err: any, req: any, res: any, next: any) => {
  if (req.client) {
    req.client.close();
  }
  console.log("SERVER ERROR " + err.stack);
  res.status(500);
  res.send(err.message);
});
