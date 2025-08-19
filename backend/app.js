const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { sql, poolPromise } = require("./db");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Internal Server Error");
});

const testConnection = async () => {
  try {
    const pool = await poolPromise;
    await pool.request().query("SELECT 1");
    console.log("Connected to SQL Server successfully.");
  } catch (err) {
    console.error("Database connection failed:", err);
  }
};
testConnection();

app.post("/api/admin", async (req, res) => {
  const { username, password } = req.body;
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("username", sql.NVarChar, username)
      .input("password", sql.NVarChar, password)
      .query(
        "SELECT * FROM Users WHERE username = @username AND password = @password"
      );

    if (result.recordset.length > 0) {
      res.status(200).json({ user: result.recordset[0], role: "admin" });
    } else {
      res.status(401).json({ message: "Invalid admin credentials" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auth", async (req, res) => {
  const { action, username, password, email, phone } = req.body;
  try {
    const pool = await poolPromise;

    if (action === "login") {
      const result = await pool
        .request()
        .input("username", sql.NVarChar, username)
        .input("password", sql.NVarChar, password)
        .query(
          "SELECT * FROM LoginTable WHERE username = @username AND password = @password"
        );

      if (!result.recordset.length) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      return res.status(200).json({ user: result.recordset[0], role: "user" });
    }

    if (action === "signup") {
      const exists = await pool
        .request()
        .input("username", sql.VarChar, username)
        .query("SELECT * FROM LoginTable WHERE username = @username");

      if (exists.recordset.length) {
        return res.status(400).json({ message: "Username already exists" });
      }

      await pool
        .request()
        .input("username", sql.VarChar, username)
        .input("password", sql.VarChar, password)
        .input("email", sql.VarChar, email)
        .input("phone", sql.VarChar, phone)
        .query(
          "INSERT INTO LoginTable (username, password, email, phone) VALUES (@username, @password, @email, @phone)"
        );

      const newUser = await pool
        .request()
        .input("username", sql.VarChar, username)
        .query("SELECT * FROM LoginTable WHERE username = @username");

      return res.status(200).json({ user: newUser.recordset[0], role: "user" });
    }

    return res.status(400).json({ message: "Invalid action" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

const { Readable } = require("stream");

app.get("/api/images/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid image ID" });
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT Name, ImageData FROM Images WHERE Id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Image not found" });
    }

    const image = result.recordset[0];

    // Set headers dynamically
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Disposition", `inline; filename="${image.Name}"`);

    // Stream image for large files
    const stream = new Readable();
    stream.push(image.ImageData);
    stream.push(null);
    stream.pipe(res);
  } catch (err) {
    console.error("Error fetching image:", err);
    res
      .status(500)
      .json({ error: "Error fetching image", details: err.message });
  }
});

app.get("/api/posts", async (req, res) => {
  const username = req.query.username;

  try {
    const pool = await poolPromise;
    const request = pool.request();

    if (username) {
      request.input("username", sql.NVarChar, username);
    }

    const query = `
      SELECT
        p.id,
        p.title,
        p.summary,
        p.author,
        p.post_date,
        p.logoId,
        p.ImageId,
        logoImg.Name AS logoImageName,
        postImg.Name AS postImageName,
        (SELECT COUNT(*) FROM Comments WHERE post_id = p.id) AS commentCount,
        (SELECT COUNT(*) FROM PostLikes WHERE post_id = p.id) AS likes,
        ${
          username
            ? "(SELECT COUNT(*) FROM PostLikes WHERE post_id = p.id AND username = @username) AS isLiked"
            : "CAST(0 AS BIT) AS isLiked"
        }
      FROM BlogPosts p
      LEFT JOIN Images logoImg ON p.logoId = logoImg.Id
      LEFT JOIN Images postImg ON p.ImageId = postImg.Id
      ORDER BY p.post_date DESC
    `;

    const result = await request.query(query);
    result.recordset.forEach((post) => {
      post.isLiked = !!post.isLiked;
    });

    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching posts:", err);
    res.status(500).json({ message: "Failed to load posts" });
  }
});

app.post(
  "/api/posts",
  upload.fields([
    { name: "logoImage", maxCount: 1 },
    { name: "postImage", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const pool = await poolPromise;
      const { title, summary } = req.body;

      const postImage = req.files?.["postImage"]?.[0];

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        const request = new sql.Request(transaction);
        let logoImageId = 1;
        let postImageId = null;

        if (postImage) {
          const postResult = await request
            .input("Name", sql.NVarChar, postImage.originalname)
            .input("ImageData", sql.VarBinary(sql.MAX), postImage.buffer)
            .query(
              `INSERT INTO Images (Name, ImageData) OUTPUT INSERTED.Id 
               VALUES (@Name, @ImageData)`
            );
          postImageId = postResult.recordset[0].Id;
        }

        const author = "Wander With KI";

        const blogResult = await request
          .input("title", sql.NVarChar, title)
          .input("summary", sql.NVarChar, summary)
          .input("author", sql.NVarChar, author)
          .input("post_date", sql.DateTime, new Date())
          .input("likes", sql.Int, 0)
          .input("logoId", sql.Int, logoImageId)
          .input("ImageId", sql.Int, postImageId)
          .query(
            `INSERT INTO BlogPosts (title, summary, author, post_date, likes, logoId, ImageId) 
             OUTPUT INSERTED.id AS postId 
             VALUES (@title, @summary, @author, 
                     @post_date, @likes, @logoId, @ImageId)`
          );

        await transaction.commit();
        res.status(201).json({
          message: "Post created successfully",
          postId: blogResult.recordset[0].postId,
        });
      } catch (error) {
        await transaction.rollback();
        console.error("Transaction error:", error);
        res.status(500).json({
          error: "Failed to create post",
          details: error.message,
        });
      }
    } catch (error) {
      console.error("Server error:", error);
      res.status(500).json({ error: "Server error during post upload" });
    }
  }
);

app.put(
  "/api/posts/:id",
  upload.fields([{ name: "logoImage" }, { name: "postImage" }]),
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { title, summary } = req.body;

    if (isNaN(id) || !title || !summary) {
      return res
        .status(400)
        .json({ error: "Missing required fields or invalid id" });
    }

    try {
      const pool = await poolPromise;
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        // --- Update basic fields ---
        await new sql.Request(transaction)
          .input("id", sql.Int, id)
          .input("title", sql.NVarChar, title)
          .input("summary", sql.NVarChar, summary)
          .query(
            `UPDATE BlogPosts 
             SET title = @title, summary = @summary 
             WHERE id = @id`
          );

        // --- Replace Post Image if provided ---
        const postFile = req.files?.["postImage"]?.[0];
        if (postFile) {
          // Insert new image row
          const postImgInsert = await new sql.Request(transaction)
            .input("Name", sql.NVarChar, postFile.originalname)
            .input("ImageData", sql.VarBinary(sql.MAX), postFile.buffer)
            .query(
              "INSERT INTO Images (Name, ImageData) OUTPUT INSERTED.Id VALUES (@Name, @ImageData)"
            );

          const newPostImgId = postImgInsert.recordset[0].Id;

          // Update BlogPosts.imageid to new image
          await new sql.Request(transaction)
            .input("id", sql.Int, id)
            .input("ImageId", sql.Int, newPostImgId)
            .query("UPDATE BlogPosts SET ImageId = @ImageId WHERE id = @id");
        }

        // --- Replace Logo Image if provided ---
        const logoFile = req.files?.["logoImage"]?.[0];
        if (logoFile) {
          // Insert new image row
          const logoImgInsert = await new sql.Request(transaction)
            .input("Name", sql.NVarChar, logoFile.originalname)
            .input("ImageData", sql.VarBinary(sql.MAX), logoFile.buffer)
            .query(
              "INSERT INTO Images (Name, ImageData) OUTPUT INSERTED.Id VALUES (@Name, @ImageData)"
            );

          const newLogoImgId = logoImgInsert.recordset[0].Id;

          // Update BlogPosts.logoId to new image
          await new sql.Request(transaction)
            .input("id", sql.Int, id)
            .input("logoId", sql.Int, newLogoImgId)
            .query("UPDATE BlogPosts SET logoId = @logoId WHERE id = @id");
        }

        await transaction.commit();
        return res.status(200).json({ message: "Post updated successfully" });
      } catch (error) {
        await transaction.rollback();
        console.error("Transaction error:", error);
        return res.status(500).json({ error: "Failed to update post" });
      }
    } catch (err) {
      console.error("Server error:", err);
      return res.status(500).json({ error: "Server error during post update" });
    }
  }
);

app.delete("/api/posts/:id", async (req, res) => {
  const { id } = req.params;
  console.log("Deleting post with id:", id);

  const postId = parseInt(id, 10);
  if (isNaN(postId)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }

  try {
    const pool = await poolPromise;

    await pool
      .request()
      .input("post_id", sql.Int, postId)
      .query("DELETE FROM PostLikes WHERE post_id = @post_id");

    await pool
      .request()
      .input("id", sql.Int, postId)
      .query("DELETE FROM BlogPosts WHERE id = @id");

    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("Error deleting post:", err);
    res.status(500).json({ message: "Failed to delete post" });
  }
});

app.get("/api/comments/:postId", async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("postId", sql.Int, postId)
      .query(
        "SELECT * FROM Comments WHERE post_id = @postId ORDER BY comment_date DESC"
      );

    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching comments:", err);
    res.status(500).json({ message: "Failed to load comments" });
  }
});

app.post("/api/comments", async (req, res) => {
  const { post_id, username, message } = req.body;

  if (!post_id || !username || !message) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("post_id", sql.Int, post_id)
      .input("username", sql.NVarChar, username)
      .input("message", sql.NVarChar, message)
      .query(
        "INSERT INTO Comments (post_id, username, message, comment_date) VALUES (@post_id, @username, @message, GETDATE())"
      );

    res.status(201).json({ message: "Comment added successfully" });
  } catch (err) {
    console.error("Error adding comment:", err);
    res.status(500).json({ message: "Failed to add comment" });
  }
});

app.delete("/api/comments/:id", async (req, res) => {
  const commentId = parseInt(req.params.id);

  if (!commentId) {
    return res.status(400).json({ message: "Comment ID is required" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.Int, commentId)
      .query("DELETE FROM Comments WHERE id = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Comment not found" });
    }

    res.json({ message: "Comment deleted successfully" });
  } catch (err) {
    console.error("Error deleting comment:", err);
    res.status(500).json({ message: "Failed to delete comment" });
  }
});

app.post("/api/posts/:id/like", async (req, res) => {
  const postId = parseInt(req.params.id);
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }

  try {
    const pool = await poolPromise;
    const checkResult = await pool
      .request()
      .input("post_id", sql.Int, postId)
      .input("username", sql.NVarChar, username)
      .query(
        "SELECT * FROM PostLikes WHERE post_id = @post_id AND username = @username"
      );

    let isLiked;
    if (checkResult.recordset.length > 0) {
      await pool
        .request()
        .input("post_id", sql.Int, postId)
        .input("username", sql.NVarChar, username)
        .query(
          "DELETE FROM PostLikes WHERE post_id = @post_id AND username = @username"
        );
      isLiked = false;
    } else {
      await pool
        .request()
        .input("post_id", sql.Int, postId)
        .input("username", sql.NVarChar, username)
        .query(
          "INSERT INTO PostLikes (post_id, username, liked_at) VALUES (@post_id, @username, GETDATE())"
        );
      isLiked = true;
    }

    await pool.request().input("post_id", sql.Int, postId).query(`
        UPDATE BlogPosts
        SET likes = (SELECT COUNT(*) FROM PostLikes WHERE post_id = @post_id)
        WHERE id = @post_id
      `);

    const likeCountResult = await pool
      .request()
      .input("post_id", sql.Int, postId)
      .query("SELECT likes FROM BlogPosts WHERE id = @post_id");

    res.status(200).json({
      message: isLiked ? "Post liked" : "Post unliked",
      likes: likeCountResult.recordset[0].likes,
      isLiked,
    });
  } catch (err) {
    console.error("Error toggling like:", err);
    res.status(500).json({ message: "Failed to toggle like" });
  }
});

app.get("/api/bucketlist", async (req, res) => {
  const { completed } = req.query;
  try {
    const pool = await poolPromise;
    let query = "SELECT * FROM AdventureBucketList";
    const request = pool.request();

    if (completed !== undefined) {
      query += " WHERE Completed = @completed";
      request.input("completed", sql.Bit, completed === "true");
    }

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching bucket list items:", err);
    res.status(500).send("Failed to fetch bucket list items");
  }
});

app.post("/api/bucketlist", async (req, res) => {
  const { name, emoji, country, latitude, longitude, funFact, uniqueThing } =
    req.body;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("Name", sql.NVarChar(100), name)
      .input("Emoji", sql.NVarChar(10), emoji)
      .input("Country", sql.NVarChar(100), country)
      .input("Latitude", sql.Float, latitude)
      .input("Longitude", sql.Float, longitude)
      .input("FunFact", sql.NVarChar(500), funFact) // Adjust size as needed
      .input("UniqueThing", sql.NVarChar(500), uniqueThing) // Adjust size as needed
      .query(
        `INSERT INTO AdventureBucketList (Name, Emoji, Country, Latitude, Longitude, FunFact, UniqueThing)
         VALUES (@Name, @Emoji, @Country, @Latitude, @Longitude, @FunFact, @UniqueThing)`
      );

    res
      .status(201)
      .json({ message: "Bucket item added with fun fact and unique thing" });
  } catch (error) {
    console.error("Failed to insert bucket item:", error);
    res.status(500).json({ error: "Failed to insert bucket item" });
  }
});

app.delete("/api/bucketlist/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM AdventureBucketList WHERE Id = @id");

    res.status(200).json({ message: "Bucket list item deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete bucket list item" });
  }
});

app.get("/api/fooditems", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        f.Id,
        f.Name,
        f.Description,
        f.Location,
        f.Rating,
        f.ImageId,
        i.Name AS ImageName,
        i.ImageData
      FROM FoodItems f
      LEFT JOIN Images i ON f.ImageId = i.Id
      ORDER BY f.Id
    `);

    const foodItems = result.recordset.map((item) => ({
      ...item,
      imageBase64: item.ImageData
        ? `data:image/jpeg;base64,${item.ImageData.toString("base64")}`
        : null,
    }));

    res.json(foodItems);
  } catch (err) {
    console.error("Error fetching food items:", err);
    res
      .status(500)
      .json({ message: "Failed to get food items", error: err.message });
  }
});

app.post("/api/fooditems", upload.single("image"), async (req, res) => {
  const { name, description, location, rating } = req.body;

  if (!name || !description || !location || !req.file) {
    return res
      .status(400)
      .json({ message: "Missing required fields or image." });
  }

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const imageRequest = new sql.Request(transaction);

      const imageInsert = await imageRequest
        .input("Name", sql.NVarChar, req.file.originalname)
        .input("ImageData", sql.VarBinary(sql.MAX), req.file.buffer).query(`
          INSERT INTO Images (Name, ImageData)
          OUTPUT INSERTED.Id
          VALUES (@Name, @ImageData)
        `);

      const imageId = imageInsert.recordset[0].Id;

      await new sql.Request(transaction)
        .input("name", sql.NVarChar, name)
        .input("description", sql.NVarChar, description)
        .input("location", sql.NVarChar, location)
        .input("rating", sql.Int, rating || 0)
        .input("imageId", sql.Int, imageId).query(`
          INSERT INTO FoodItems (Name, Description, Location, Rating, ImageId)
          VALUES (@name, @description, @location, @rating, @imageId)
        `);

      await transaction.commit();
      res.status(201).json({ message: "Food item created successfully." });
    } catch (err) {
      await transaction.rollback();
      console.error("Transaction error (POST):", err);
      res.status(500).json({ message: "Failed to create food item." });
    }
  } catch (err) {
    console.error("Server error (POST):", err);
    res.status(500).json({ message: "Server error during food item upload." });
  }
});

app.put("/api/fooditems/:id", upload.single("image"), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, description, location, rating } = req.body;

  if (isNaN(id) || !name || !description || !location) {
    return res.status(400).json({ message: "Invalid ID or missing fields." });
  }

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = new sql.Request(transaction);

      await request
        .input("id", sql.Int, id)
        .input("name", sql.NVarChar, name)
        .input("description", sql.NVarChar, description)
        .input("location", sql.NVarChar, location)
        .input("rating", sql.Int, rating || 0).query(`
          UPDATE FoodItems
          SET Name = @name, Description = @description, Location = @location, Rating = @rating
          WHERE Id = @id
        `);

      if (req.file) {
        const buffer = req.file.buffer;

        const imageIdResult = await new sql.Request(transaction)
          .input("id", sql.Int, id)
          .query("SELECT ImageId FROM FoodItems WHERE Id = @id");

        const currentImageId = imageIdResult.recordset[0]?.ImageId;

        if (currentImageId) {
          await new sql.Request(transaction)
            .input("ImageData", sql.VarBinary(sql.MAX), buffer)
            .input("id", sql.Int, currentImageId)
            .query("UPDATE Images SET ImageData = @ImageData WHERE Id = @id");
        } else {
          const newImage = await new sql.Request(transaction)
            .input("Name", sql.NVarChar, req.file.originalname)
            .input("ImageData", sql.VarBinary(sql.MAX), buffer)
            .query(
              "INSERT INTO Images (Name, ImageData) OUTPUT INSERTED.Id VALUES (@Name, @ImageData)"
            );

          const newImageId = newImage.recordset[0].Id;

          await new sql.Request(transaction)
            .input("ImageId", sql.Int, newImageId)
            .input("id", sql.Int, id)
            .query("UPDATE FoodItems SET ImageId = @ImageId WHERE Id = @id");
        }
      }

      await transaction.commit();
      res.json({ message: "Food item updated successfully." });
    } catch (err) {
      await transaction.rollback();
      console.error("Transaction error (PUT):", err);
      res.status(500).json({ message: "Failed to update food item." });
    }
  } catch (err) {
    console.error("Server error (PUT):", err);
    res.status(500).json({ message: "Server error during food item update." });
  }
});

app.delete("/api/fooditems/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT ImageId FROM FoodItems WHERE Id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Food item not found" });
    }

    const imageId = result.recordset[0].ImageId;

    await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM FoodItems WHERE Id = @id");

    if (imageId) {
      await pool
        .request()
        .input("imageId", sql.Int, imageId)
        .query("DELETE FROM Images WHERE Id = @imageId");
    }

    res.json({ message: "Food item and related image deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to delete food item and related image");
  }
});

app.get("/api/adventures", async (_req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        a.Id,
        a.Name,
        a.Description,
        a.Location,
        a.ImageId,
        i.Name AS ImageName,
        i.ImageData
      FROM Adventures a
      LEFT JOIN Images i ON a.ImageId = i.Id
      ORDER BY a.Id
    `);

    const adventures = result.recordset.map((item) => ({
      ...item,
      imageBase64: item.ImageData
        ? `data:image/jpeg;base64,${item.ImageData.toString("base64")}`
        : null,
    }));

    res.json(adventures);
  } catch (err) {
    console.error("Error fetching adventures:", err);
    res
      .status(500)
      .json({ message: "Failed to get adventures", error: err.message });
  }
});

app.post("/api/adventures", upload.single("image"), async (req, res) => {
  const { name, description, location } = req.body;

  if (!name || !description || !location || !req.file) {
    return res
      .status(400)
      .json({ message: "Missing required fields or image." });
  }

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const imageRequest = new sql.Request(transaction);

      const imageInsert = await imageRequest
        .input("Name", sql.NVarChar, req.file.originalname)
        .input("ImageData", sql.VarBinary(sql.MAX), req.file.buffer).query(`
          INSERT INTO Images (Name, ImageData)
          OUTPUT INSERTED.Id
          VALUES (@Name, @ImageData)
        `);

      const imageId = imageInsert.recordset[0].Id;

      await new sql.Request(transaction)
        .input("name", sql.NVarChar, name)
        .input("description", sql.NVarChar, description)
        .input("location", sql.NVarChar, location)
        .input("imageId", sql.Int, imageId).query(`
          INSERT INTO Adventures (Name, Description, Location, ImageId)
          VALUES (@name, @description, @location, @imageId)
        `);

      await transaction.commit();
      res.status(201).json({ message: "Adventure created successfully." });
    } catch (err) {
      await transaction.rollback();
      console.error("Transaction error (POST):", err);
      res.status(500).json({ message: "Failed to create adventure." });
    }
  } catch (err) {
    console.error("Server error (POST):", err);
    res.status(500).json({ message: "Server error during adventure upload." });
  }
});

app.put("/api/adventures/:id", upload.single("image"), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, description, location } = req.body;

  if (isNaN(id) || !name || !description || !location) {
    return res.status(400).json({ message: "Invalid ID or missing fields." });
  }

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = new sql.Request(transaction);

      await request
        .input("id", sql.Int, id)
        .input("name", sql.NVarChar, name)
        .input("description", sql.NVarChar, description)
        .input("location", sql.NVarChar, location).query(`
          UPDATE Adventures
          SET Name = @name, Description = @description, Location = @location
          WHERE Id = @id
        `);

      if (req.file) {
        const buffer = req.file.buffer;

        const imageIdResult = await new sql.Request(transaction)
          .input("id", sql.Int, id)
          .query("SELECT ImageId FROM Adventures WHERE Id = @id");

        const currentImageId = imageIdResult.recordset[0]?.ImageId;

        if (currentImageId) {
          await new sql.Request(transaction)
            .input("ImageData", sql.VarBinary(sql.MAX), buffer)
            .input("id", sql.Int, currentImageId)
            .query("UPDATE Images SET ImageData = @ImageData WHERE Id = @id");
        } else {
          const newImage = await new sql.Request(transaction)
            .input("Name", sql.NVarChar, req.file.originalname)
            .input("ImageData", sql.VarBinary(sql.MAX), buffer)
            .query(
              "INSERT INTO Images (Name, ImageData) OUTPUT INSERTED.Id VALUES (@Name, @ImageData)"
            );

          const newImageId = newImage.recordset[0].Id;

          await new sql.Request(transaction)
            .input("ImageId", sql.Int, newImageId)
            .input("id", sql.Int, id)
            .query("UPDATE Adventures SET ImageId = @ImageId WHERE Id = @id");
        }
      }

      await transaction.commit();
      res.json({ message: "Adventure updated successfully." });
    } catch (err) {
      await transaction.rollback();
      console.error("Transaction error (PUT):", err);
      res.status(500).json({ message: "Failed to update adventure." });
    }
  } catch (err) {
    console.error("Server error (PUT):", err);
    res.status(500).json({ message: "Server error during adventure update." });
  }
});

app.delete("/api/adventures/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT ImageId FROM Adventures WHERE Id = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Adventure not found" });
    }

    const imageId = result.recordset[0].ImageId;

    await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM Adventures WHERE Id = @id");

    if (imageId) {
      await pool
        .request()
        .input("imageId", sql.Int, imageId)
        .query("DELETE FROM Images WHERE Id = @imageId");
    }

    res.json({ message: "Adventure and related image deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to delete adventure and related image");
  }
});

app.get("/api/home", async (_req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        ws.Id, 
        ws.Type,
        ws.Title,
        ws.Description,
        ws.Content1,
        ws.Content2,
        ws.Sort_Order,
        ws.imageid,
        i.Name AS ImageName
      FROM WebsiteSections ws
      LEFT JOIN Images i ON ws.imageid = i.Id
      ORDER BY ws.Sort_Order ASC
    `);

    const sections = result.recordset.map((section) => ({
      Id: section.Id,
      Type: section.Type,
      Title: section.Title,
      Description: section.Description,
      Content1: section.Content1,
      Content2: section.Content2,
      Sort_Order: section.Sort_Order,
      ImageId: section.imageid,
      ImageName: section.ImageName,
    }));

    res.json(sections);
  } catch (err) {
    console.error("Error fetching sections:", err.message);
    res.status(500).send("Failed to fetch website sections");
  }
});

app.post("/api/home", upload.single("image"), async (req, res) => {
  const { type, title, description, content1, content2, sort_order } = req.body;

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = new sql.Request(transaction);

      let imageId = null;
      if (req.file) {
        const imageResult = await request
          .input("Name", sql.NVarChar, req.file.originalname)
          .input("ImageData", sql.VarBinary(sql.MAX), req.file.buffer).query(`
            INSERT INTO Images (Name, ImageData)
            OUTPUT INSERTED.Id
            VALUES (@Name, @ImageData)
          `);
        imageId = imageResult.recordset[0].Id;
      }

      await request
        .input("Type", sql.NVarChar, type)
        .input("Title", sql.NVarChar, title)
        .input("Description", sql.NVarChar, description)
        .input("Content1", sql.NVarChar, content1 || null)
        .input("Content2", sql.NVarChar, content2 || null)
        .input("SortOrder", sql.Int, sort_order)
        .input("ImageId", sql.Int, imageId).query(`
          INSERT INTO WebsiteSections (Type, Title, Description, Content1, Content2, Sort_Order, ImageId)
          VALUES (@Type, @Title, @Description, @Content1, @Content2, @SortOrder, @ImageId)
        `);

      await transaction.commit();
      res.status(201).json({ message: "Section created successfully" });
    } catch (err) {
      await transaction.rollback();
      console.error("Transaction error:", err.message);
      res.status(500).json({ error: "Failed to create section" });
    }
  } catch (err) {
    console.error("Server error:", err.message);
    res.status(500).json({ error: "Server error during section creation" });
  }
});

app.put("/api/home/:id", upload.single("image"), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, description, content1, content2 } = req.body;

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = new sql.Request(transaction);

      await request
        .input("id", sql.Int, id)
        .input("title", sql.NVarChar, title)
        .input("description", sql.NVarChar, description)
        .input("content1", sql.NVarChar, content1)
        .input("content2", sql.NVarChar, content2).query(`
          UPDATE WebsiteSections
          SET Title = @title,
              Description = @description,
              Content1 = @content1,
              Content2 = @content2
          WHERE Id = @id
        `);

      let updatedImageId = null;

      if (req.file) {
        const buffer = req.file.buffer;

        const imageIdResult = await new sql.Request(transaction)
          .input("id", sql.Int, id)
          .query("SELECT ImageId FROM WebsiteSections WHERE Id = @id");

        const currentImageId = imageIdResult.recordset[0]?.ImageId;

        if (currentImageId) {
          await new sql.Request(transaction)
            .input("ImageData", sql.VarBinary(sql.MAX), buffer)
            .input("id", sql.Int, currentImageId)
            .query("UPDATE Images SET ImageData = @ImageData WHERE Id = @id");
          updatedImageId = currentImageId;
        } else {
          const newImage = await new sql.Request(transaction)
            .input("Name", sql.NVarChar, req.file.originalname)
            .input("ImageData", sql.VarBinary(sql.MAX), buffer)
            .query(
              "INSERT INTO Images (Name, ImageData) OUTPUT INSERTED.Id VALUES (@Name, @ImageData)"
            );
          updatedImageId = newImage.recordset[0].Id;

          await new sql.Request(transaction)
            .input("ImageId", sql.Int, updatedImageId)
            .input("id", sql.Int, id)
            .query(
              "UPDATE WebsiteSections SET ImageId = @ImageId WHERE Id = @id"
            );
        }
      }

      await transaction.commit();
      res.json({
        message: "Section updated successfully",
        imageId: updatedImageId,
      });
    } catch (err) {
      await transaction.rollback();
      console.error("Transaction error (PUT):", err);
      res.status(500).json({ message: "Failed to update section." });
    }
  } catch (err) {
    console.error("Server error (PUT):", err);
    res.status(500).json({ message: "Server error during section update." });
  }
});

app.delete("/api/home/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ message: "Invalid ID" });

  try {
    const pool = await poolPromise;

    const imageResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT ImageId FROM WebsiteSections WHERE Id = @id");

    if (imageResult.recordset.length === 0) {
      return res.status(404).json({ message: "Section not found" });
    }

    const imageId = imageResult.recordset[0].ImageId;

    const deleteResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM WebsiteSections WHERE Id = @id");

    if (deleteResult.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Section not found" });
    }

    if (imageId) {
      await pool
        .request()
        .input("imageId", sql.Int, imageId)
        .query("DELETE FROM Images WHERE Id = @imageId");
    }

    res.json({ message: "Section and related image deleted" });
  } catch (err) {
    console.error("Error deleting section:", err.message);
    res.status(500).json({ message: "Failed to delete section" });
  }
});

// --- Wishlist (fetch by username) ---
app.get("/api/wishlist/:username", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("username", sql.NVarChar, req.params.username).query(`
        SELECT b.id, b.Name as name, b.Country as country,
               b.Latitude as latitude, b.Longitude as longitude,
               b.Emoji as emoji, b.FunFact as funfact, b.UniqueThing as uniquething
        FROM UserWishlist uw
        INNER JOIN AdventureBucketList b ON uw.BucketItemId = b.Id
        INNER JOIN LoginTable u ON uw.UserId = u.Id
        WHERE u.Username = @username
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching wishlist:", err);
    res.status(500).send("Server error fetching wishlist");
  }
});

// --- Liked Posts ---
app.get("/api/liked-posts/:username", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("username", sql.VarChar, req.params.username).query(`
        SELECT p.id, p.title, p.summary, p.post_date, l.liked_at
        FROM PostLikes l
        INNER JOIN BlogPosts p ON l.post_id = p.id
        WHERE l.username = @username
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching liked posts:", err);
    res.status(500).send("Server error fetching liked posts");
  }
});

// --- User Comments ---
app.get("/api/user-comments/:username", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("username", sql.VarChar, req.params.username).query(`
        SELECT c.id, c.post_id, c.message, c.comment_date, p.title AS posttitle
        FROM Comments c
        INNER JOIN BlogPosts p ON c.post_id = p.id
        WHERE c.username = @username
        ORDER BY c.comment_date DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching user comments:", err);
    res.status(500).send("Server error fetching comments");
  }
});

module.exports = app;
