/* global db, ObjectId */

db.users.insertMany([
  { _id: ObjectId("507f1f77bcf86cd799439011"), name: "Ada", email: "ada@example.com", age: 32 },
  { _id: ObjectId("507f1f77bcf86cd799439012"), name: "Linus", email: "linus@example.com", age: 41 }
]);

db.orders.insertMany([
  {
    _id: ObjectId("507f1f77bcf86cd799439101"),
    user_id: ObjectId("507f1f77bcf86cd799439011"),
    total: 120.5,
    status: "paid"
  },
  {
    _id: ObjectId("507f1f77bcf86cd799439102"),
    user_id: ObjectId("507f1f77bcf86cd799439012"),
    total: 88,
    status: "pending"
  }
]);

db.users.createIndex({ email: 1 }, { unique: true });
db.orders.createIndex({ user_id: 1 });
