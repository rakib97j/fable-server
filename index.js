const express = require("express");
const cors =require('cors');
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const app = express();


app.use(cors());
app.use(express.json());

const port = process.env.PORT || 9090;
const uri = process.env.MONGODB_URI;





app.get("/", (req, res) => {
  res.send("Hello World!");
});

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});



async function run() {
  try {
    await client.connect();

    const db = client.db("fable_db");
    const eBooksCollection = db.collection("e-books")

    // ebook  post api
    app.post('/api/e-books' , async (req ,res)=>{
        const eBooks = req.body;
        const result = await eBooksCollection.insertOne(eBooks);
        res.send(result)
    })



    
    // all-ebook get api
    app.get('/api/e-books' ,async (req ,res) => {
        const result =await eBooksCollection.find().toArray()
        res.send(result)
    })
    








    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
