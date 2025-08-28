// require("dotenv").config();

import dotenv from "dotenv";
import express from "express";
import connectDB from "./db/index.js";

dotenv.config("./env");

const app = express();

connectDB()
.then(() => {

    app.on("error", (error) => {
        console.log("Error connecting to database:", error);
    });

    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running at port ${process.env.PORT}`);
    });
})
.catch((error) => {
    console.log("Error connecting to database:", error);
})
