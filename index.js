const express = require("express");
const { MongoClient, ServerApiVersion} = require("mongodb");
const ObjectID = require('mongodb').ObjectId;
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

// user: dbuser1
// pass:xXkEmUlaz1h7KUJ2
app.use(
  cors({ origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }) 
  );

app.use(
  cors({ origin:"https://food-village-6c8a6.web.app"}));



// middleware
app.use(cors());
app.use(express.json());



// app.use(cors(corsConfig));
// app.options('*', cors(corsConfig));
// // app.use(cors({ origin:"https://food-village-6c8a6.web.app/" }))
// app.use(express.json())





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zkzwp.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// verifing JWT
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  // console.log(token);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbiddden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const foodCollection = client.db("foodExpress").collection("foods");
    const reviewCollection = client.db("foodExpress").collection("review");
    const orderCollection = client.db("foodExpress").collection("order");
    const usersCollection = client.db("foodExpress").collection("users");
    const statusCollection = client.db("foodExpress").collection("status");

    // if client site sent data by PUT then server receive by PUT method//
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(filter,updateDoc,options);
      const token = jwt.sign({ email: email },process.env.ACCESS_TOKEN_SECRET,{ expiresIn: "12hr" }
      );

      res.send({ result, token });
    });


    ///...set an admin field...///
    app.get("/users/role/:email/:role", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const role = req.params.role;
      const requester = req.decoded.email;
      const requesterAccount = await usersCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        const filter = { email: email };
        const updateDoc = {
          $set: { role: role },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden..." });
      }
    });

    app.delete("/users/:email",  async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    // API htmlFor load data from server
    app.get("/foods", async (req, res) => {
      const query = {};
      const cursor = foodCollection.find(query);
      const users = await cursor.toArray();
      res.send(users);
    });

    app.get('/chef/:email', async(req,res)=>{
      const email=req.params.email;
      const user=await usersCollection.findOne({email:email});
      const isChef=user.role==='chef';
      res.send({chef:isChef})
    })

    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    app.get("/review", async (req, res) => {
      const query = {};
      const cursor = reviewCollection.find(query);
      const review = await cursor.toArray();
      res.send(review);
    });

    app.get("/order", async (req, res) => {
      const quary = {};
      const cursor = orderCollection.find(quary);
      const order = await cursor.toArray();
      res.send(order);
    });

// logic by Emad vai///

    app.get("/orderbyUser", verifyJWT, async (req, res) => {
      const userQuery = { uid: req.query.user };
      // console.log(userQuery);
      const orderQuery = { userId: req.query.user, status: req.query.status };

      // console.log(orderQuery);
      const user = await usersCollection.findOne(userQuery);
      var orders = await orderCollection.find(orderQuery).toArray();
      // console.log(orders);
      var ordersData = [];
      for (const order of orders) {
        const foodquery = { _id: ObjectID(order.foodId) };
        const food = await foodCollection.findOne(foodquery);
        // console.log(food);
        ordersData.push({
          _id: order._id,
          image: food.img,
          foodName: food.name,
          user: user.email,
          price:food.price,
          token: order.token,
          status: order.status,
        });
      }
      res.status(200).send(ordersData);
    });

    app.get("/allorderlist/:status", async (req, res) => {
      // console.log(req.params.status);

      var orders = await orderCollection
        .find({ status: req.params.status })
        .toArray();

      var ordersData = [];
      for (const order of orders) {
        const foodquery = { _id: ObjectID(order.foodId) };
        const food = await foodCollection.findOne(foodquery);
        const user = await usersCollection.findOne({ uid: order.userId });
        ordersData.push({
          _id: order._id,
          image: food.img,
          price:food.price,
          foodName: food.name,
          user: user.email,
          token: order.token,
          status: order.status,
        });
      }
      res.status(200).send(ordersData);
    });

    app.post("/orderstatuschange", verifyJWT, async (req, res) => {
      const query = { _id: ObjectID(req.body.id) };
      const updateDoc = {
        $set: { status: req.body.status },
      };
      const result = await orderCollection.updateOne(query, updateDoc);
      res.status(200).send("Done!");
    });

    app.get("/fooddetails/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectID(id) };
      const foods = await foodCollection.findOne(query);
      res.send(foods);
    });

    // verifyJWT,
    app.get("/users", async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    app.get("/status", async (req, res) => {
      const status = await statusCollection.find().toArray();
      res.send(status);
    });

    // POST:add a new user(load data)////waiting to receive data from client
    app.post("/foods", async (req, res) => {
      const newUser = req.body;
      const result = await foodCollection.insertOne(newUser);
      console.log(`A document was inserted with the _id: ${result.insertedId}`);
      res.send(result);
    });

    app.patch("/orderstatus", async (req, res) => {
      const status = req.body;
      const result = await statusCollection.insertOne(status);
      res.send(result);
    });

    app.post("/review", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });
    
    
    // app.get("/order/aprove" ,async(req,res)=>{
    //   const result= await orderCollection.find({status:"approved"}).toArray();
    //   res.send(result);

    // })

    app.post("/order", async (req, res) => {
      const initialT = "FR";
      const randomnumber = Math.round(Math.random() * 12);
      const query = { token: initialT + randomnumber };
      const tokenFind = await orderCollection.findOne(query);
      var finalToken;
      if (tokenFind == null) {
        finalToken = initialT + randomnumber;
      } else {
        finalToken = tokenFind.token + randomnumber;
      }
      var order = {
        foodId: req.body.foodId,
        userId: req.body.userId,
        status: req.body.status,
        token: finalToken,
      };
      const result = await orderCollection.insertOne(order);
      res.send(result);
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(" Food Ranger server is Running....");
});

app.listen(port, () => {
  console.log("funky Server is Running");
});
