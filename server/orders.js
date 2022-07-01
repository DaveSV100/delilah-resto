const express = require("express");
const sequelize = require("../database/connection.js");
const jwt = require("jsonwebtoken");
const expressJwt = require("express-jwt");
const jwtKey = process.env.JWTKEY;
const router = express.Router();
const {
  checkAdmin,
  verifyUser,
  existingUser,
  verifyDish,
  verifyOrder,
  getDish,
  getOrder
} = require("../utils/utils.js");
const { use } = require("./users.js");

// //algorithms: ["RS256"]
router.use(
  expressJwt({ secret: jwtKey, algorithms: ["HS256"] }).unless({
    path: ["/"],
  })
);
router.use(function (err, req, res, next) {
  if (err.name === "UnauthorizedError") {
    res.status(401).send("You need to sign in or sign up");
  } else {
    next(err);
  }
});

router.get("/orders", async (req, res) => {
  if(req.user.payload.role == 1 ) {
    try {
      const records = await sequelize.query(
      //"SELECT Orders.ID, Orders.Status, Orders.Date, Orders.Description, Orders.Payment, users.name, users.email, users.direction, users.admin FROM Orders INNER JOIN users ON Orders.User_id = users.id ORDER BY date ASC", { type: sequelize.QueryTypes.SELECT }
      //"SELECT * FROM Orders INNER JOIN dishes ON Orders.Dish_id = dishes.id INNER JOIN users ON Orders.User_id = users.id", { type: sequelize.QueryTypes.SELECT }
      "SELECT Orders_dishes.id, Orders.status, Orders.date, Dishes.description, Dishes.image, Dishes.price, Orders.payment, Users.Name, Users.direction FROM Orders INNER JOIN orders_dishes ON Orders.ID = Orders_dishes.Order_id INNER JOIN Dishes ON Orders_dishes.Dish_id = Dishes.id INNER JOIN users ON Orders.User_id = users.id ORDER BY Orders_dishes.id ASC", 
      { type: sequelize.QueryTypes.SELECT }
      )
      records.length == 0 ? res.status(404).json("There are no orders") : res.status(200).json(records);
    } catch (error) {
      res.status(400).json("Error message: " + error);
      console.error(error);
    }
  } else {
      const user_id = await req.user.payload.id
      try {
        const records = await sequelize.query(
          "SELECT Orders_dishes.id, Orders.status, Orders.date, Dishes.description, Dishes.image, Dishes.price, Orders.payment, Users.Name, Users.direction FROM Orders INNER JOIN orders_dishes ON Orders.ID = Orders_dishes.Order_id INNER JOIN Dishes ON Orders_dishes.Dish_id = Dishes.id INNER JOIN users ON Orders.User_id = users.id WHERE Users.id= :id", 
          { replacements: {id: user_id}, type: sequelize.QueryTypes.SELECT }
          )
        records[0] != null ? res.status(200).json(records) : res.status(404).json("You haven't made any order");
      } catch (error) {
        res.status(400).json("Error message: " + error);
        console.error(error);
      }
  }
})

router.post("/orders", verifyOrder, async (req, res) => {
  //ID, STATUS, DATE, TIME, DESCRIPTION, PAYMENT, USER
  const { description, payment } = req.body;
  const userId = req.user.payload.id;
  try {
    const date = new Date();
    if(typeof description == "object") {
      description.forEach(async(element) => {
        const dishId = await getDish(element);
        const makeOrder = await sequelize.query(
          "INSERT INTO orders (Status, Date, Dish_id, User_id, Payment) VALUES (:status, :date, :dish_id, :user_id, :payment)",
          { replacements: {
            status: "New",
            date: date,
            dish_id: dishId,
            user_id: userId,
            payment: payment,
          } }
        );
        const orderId = await getOrder(dishId, userId);
        const insertData = await sequelize.query(
          "INSERT INTO Orders_dishes (Order_id, Dish_id) VALUES (:order_id, :dish_id)",
          {
            replacements: {
              order_id: orderId,
              dish_id: dishId,
            }
          }
        )
      });
    } else {
      const dishId = await getDish(description);
        const makeOrder = await sequelize.query(
          "INSERT INTO orders (Status, Date, Dish_id, User_id, Payment) VALUES (:status, :date, :dish_id, :user_id, :payment)",
          { replacements: {
            status: "New",
            date: date,
            dish_id: dishId,
            user_id: userId,
            payment: payment,
          } }
        );
        const orderId = await getOrder(dishId, userId);
        const insertData = await sequelize.query(
          "INSERT INTO Orders_dishes (Order_id, Dish_id) VALUES (:order_id, :dish_id)",
          {
            replacements: {
              order_id: orderId,
              dish_id: dishId,
            }
          }
        )
    }
    res.status(200).json("Your order has been made succesfully, you can follow it");
  } catch (error) {
    console.error(error);
    res.status(400).json("Error " + error);
  }
});

router.put("/orders", checkAdmin, async (req, res) => {
  const { new_status, orderID } = req.body;
  const order_status = ["New", "Confirmed", "Preparing", "Delivering", "Cancelled", "Delivered"];
  if(new_status && orderID != undefined) {
    if(order_status.includes(new_status)) {
      try {
        const updateDish = await sequelize.query(
          "UPDATE Orders SET status = :status WHERE id = :id",
          { replacements: {status: new_status, id: orderID} }
      )
        res.status(200).json(`The order ${orderID} has been updated as: ${new_status}.`);
      } catch(error) {
        console.error(error);
        res.status(404);
      }
    } else {
      res.status(404).json("Status not found");
    }
  } else {
    res.status(400).json("You need to insert the data");
  }
})

router.delete("/orders", checkAdmin, async (req, res) => {
  try {
    const orderID = req.body.orderID;
    if(orderID != undefined) {
      const deleteOrder = await sequelize.query(
        "DELETE FROM Orders WHERE id = :id",
        { replacements: {id: orderID} }
      )
      res.status(200).json("Order deleated successfully");
    } else {
      res.status(400).json("You need to insert the ID");
    }
  } catch(error) {
    res.status(404).json("Order not found. Error message: " + error)
    console.error(error);
  }
})

module.exports = router;