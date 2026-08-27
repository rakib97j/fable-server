const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
require("dotenv").config();
const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 9090;
const uri = process.env.MONGODB_URI;

app.get("/", (req, res) => {
  res.send("FABLE Develop By rakib97j");
});

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});



const JWKS = createRemoteJWKSet(
  new URL(`${process.env.NEXT_PUBLIC_URL}/api/auth/jwks`)
)


const verifyToken =async (req ,res ,next) =>{
  const  authHeader = req?.headers.authorization;
  if(!authHeader){
    return res.status(401).json({massage : "Unauthorized"})
  }
  const token = authHeader.split(" ")[1];
   if(!token){
    return res.status(401).json({massage : "Unauthorized"})
  }

  try {
    const {payload} = await jwtVerify(token ,JWKS)
  
    next()
  } catch (error) {
    return res.status(403).json({massage : "Forbidden"})
  }

}

async function run() {
  try {
    await client.connect();

    // ==========================================
    //               DataBase
    // ==========================================

    const db = client.db("fable_db");

    // ==========================================
    //                collection
    // ==========================================
    const eBooksCollection = db.collection("e-books");
    const UserCollection = db.collection("user");
    const bookmarkCollection = db.collection("bookmarks");
    const paymentCollection = db.collection("payment");

    // ==========================================
    //               All APIs
    // ==========================================

    // ebook post api
    app.post("/api/e-books",  verifyToken, async (req, res) => {
      const eBooks = req.body;
      const newBook = {
        ...eBooks,
        status: eBooks.status || "pending",
      };
      const result = await eBooksCollection.insertOne(newBook);
      res.send(result);
    });

    // all-ebook get api (Public Library - Published & Old Books)
    app.get("/api/e-books",verifyToken, async (req, res) => {
      const query = {
        $or: [{ status: "published" }, { status: { $exists: false } }],
      };
      const result = await eBooksCollection.find(query).toArray();
      res.send(result);
    });

    // show random e-book on home page
    app.get("/api/e-books/random",verifyToken, async (req, res) => {
      const result = await eBooksCollection
        .aggregate([
          {
            $match: {
              $or: [{ status: "published" }, { status: { $exists: false } }],
            },
          },
          { $sample: { size: 4 } },
        ])
        .toArray();

      res.send(result);
    });

    // EBook details Page
    app.get("/api/e-books/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await eBooksCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // App writer API
    app.get("/api/users/writers", async (req, res) => {
      const result = await UserCollection.find({ role: "writer" }).toArray();
      res.send(result);
    });

    // Only Writers show API
    app.get("/api/users/randomWriters", async (req, res) => {
      const result = await UserCollection.aggregate([
        { $match: { role: "writer" } },
        { $sample: { size: 3 } },
      ]).toArray();

      res.send(result);
    });

    // Writer Details API (Profile + All Books)
    app.get("/api/users/writers/:id", async (req, res) => {
      const id = req.params.id;

      const result = await UserCollection.aggregate([
        {
          $match: { _id: new ObjectId(id), role: "writer" },
        },
        {
          $lookup: {
            from: "e-books",
            localField: "email",
            foreignField: "writerEmail",
            as: "publishedBooks",
          },
        },
      ]).toArray();

      if (result.length === 0) {
        return res.status(404).send({ message: "Writer not found" });
      }

      res.send(result[0]);
    });

    // ==========================================
    //               Admin APIs
    // ==========================================

    // Admin manage e book (All status) 
    app.get("/api/admin/e-books",verifyToken, async (req, res) => {
      const result = await eBooksCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    //  Admin mange user Api
    app.get("/api/users",verifyToken, async (req, res) => {
      const result = await UserCollection.find({
        role: { $in: ["reader", "writer"] },
      }).toArray();

      res.send(result);
    });

    // User Role Update API
    app.patch("/api/users/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;

      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: role,
          updatedAt: new Date().toISOString(),
        },
      };

      const result = await UserCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // 2. User Delete API 
    app.delete("/api/users/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await UserCollection.deleteOne(query);
      res.send(result);
    });

    // ==========================================
    //               Writer APIs
    // ==========================================

    // for writer manage ebook
    app.get("/api/e-books/writer/:writerId",verifyToken, async (req, res) => {
      const writerId = req.params.writerId;
      const query = { writerId: writerId };
      const result = await eBooksCollection.find(query).toArray();
      res.send(result);
    });

    // Book Details & Status Edit API (Universal Patch)
    app.patch("/api/e-books/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;

      delete updateData._id;

      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: updateData,
      };

      const result = await eBooksCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Delete Book API
    app.delete("/api/e-books/:id",verifyToken,  async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await eBooksCollection.deleteOne(query);
      res.send(result);
    });

    // ==========================================
    //               Bookmark APIs
    // ==========================================

    // Add to book mark DB
    app.post("/api/bookmarks",verifyToken, async (req, res) => {
      const { userId, book } = req.body;

      const existingBookmark = await bookmarkCollection.findOne({
        userId: userId,
        bookId: book._id,
      });

      if (existingBookmark) {
        return res.status(400).send({ message: "Already bookmarked!" });
      }

      const newBookmark = {
        userId: userId,
        bookId: book._id,
        title: book.title,
        writerName: book.writerName,
        coverImage: book.coverImage,
        genre: book.genre,
        price: book.price,
        isFree: book.isFree,
        createdAt: new Date().toISOString(),
      };

      const result = await bookmarkCollection.insertOne(newBookmark);
      res.send(result);
    });

    // get api by UserId
    app.get("/api/bookmarks/:userId",verifyToken, async (req, res) => {
      const userId = req.params.userId;
      const result = await bookmarkCollection
        .find({ userId: userId })
        .toArray();
      res.send(result);
    });

    // Bookmark delete api
    app.delete("/api/bookmarks",verifyToken, async (req, res) => {
      const { userId, bookId } = req.body;

      const query = { userId: userId, bookId: bookId };
      const result = await bookmarkCollection.deleteOne(query);

      res.send(result);
    });

    // ==========================================
    //                Payment
    // ==========================================

    // payment details post api
    app.post("/api/payment",verifyToken, async (req, res) => {
      const data = req.body;
      const payInfo = {
        ...data,
        createdAt: new Date(),
      };

      const result = await paymentCollection.insertOne(payInfo);
      res.send(result);
    });


// ==========================================
//          Payments History For Admin
// ==========================================
    app.get("/api/admin/payments",verifyToken, async (req, res) => {
      // const email = req.params.email;
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });


// ==========================================
//           Reader History Api
// ==========================================


app.get("/api/purchases/:userId", verifyToken, async (req, res) => {
  const userId = req.params.userId;

  const result = await paymentCollection
    .aggregate([
      {
        $match: {
          userId: userId,
          status: "paid",
        },
      },

      {
        $lookup: {
          from: "e-books",
          let: {
            ebookObjectId: {
              $convert: {
                input: "$ebookId",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$ebookObjectId"],
                },
              },
            },
          ],
          as: "ebook",
        },
      },

      {
        $unwind: "$ebook",
      },

      {
        $sort: {
          createdAt: -1,
        },
      },

      {
        $project: {
          _id: 1,

          // Payment information
          userId: 1,
          userEmail: 1,
          amount: 1,
          currency: 1,
          paymentMethod: 1,
          status: 1,
          createdAt: 1,
          sessionId: 1,

          // Ebook information
          ebookId: 1,
          title: "$ebook.title",
          writerName: "$ebook.writerName",
          writerEmail: "$ebook.writerEmail",
          writerId: "$ebook.writerId",
          genre: "$ebook.genre",
          price: "$ebook.price",
          isFree: "$ebook.isFree",
          description: "$ebook.description",
          coverImage: "$ebook.coverImage",
          ebookStatus: "$ebook.status",
        },
      },
    ])
    .toArray();

  res.send(result);
});


// ==========================================
//          Writer Sales History
// ==========================================

app.get("/api/sales/:writerId",verifyToken, async (req, res) => {
  const writerId = req.params.writerId;

  const result = await paymentCollection
    .aggregate([
      
      {
        $match: {
          status: "paid",
          type: "ebook",
        },
      },

      
      {
        $lookup: {
          from: "e-books",
          let: {
            ebookObjectId: {
              $convert: {
                input: "$ebookId",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$ebookObjectId"],
                },
              },
            },
          ],
          as: "ebook",
        },
      },

      {
        $unwind: "$ebook",
      },

      
      {
        $match: {
          "ebook.writerId": writerId,
        },
      },

     
      {
        $lookup: {
          from: "user",
          let: {
            buyerObjectId: {
              $convert: {
                input: "$userId",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$buyerObjectId"],
                },
              },
            },
          ],
          as: "buyer",
        },
      },

      {
        $unwind: {
          path: "$buyer",
          preserveNullAndEmptyArrays: true,
        },
      },

      
      {
        $sort: {
          createdAt: -1,
        },
      },

      {
        $project: {
          _id: 1,

          ebookId: 1,
          ebookTitle: "$ebook.title",

          buyerName: "$buyer.name",
          buyerEmail: "$userEmail",

          purchaseDate: "$createdAt",
          amount: 1,
          currency: 1,
          status: 1,
        },
      },
    ])
    .toArray();

  res.send(result);
});




    // ==========================================
    //                last
    // ==========================================

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
