const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const pool = require("./db");
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
    const result = await pool.query("SELECT NOW()");
    console.log("Connected to PostgreSQL:", result.rows[0].now);
  } catch (err) {
    console.error("Database connection failed:", err);
  }
};
testConnection();
const FileType = require("file-type");

app.get("/api/images/:id", async (req, res) => {
  const imageId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query(
      "SELECT ImageData FROM Images WHERE Id = $1",
      [imageId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Image not found" });
    }

    const imageBuffer = result.rows[0].imagedata;
    const type = await FileType.fromBuffer(imageBuffer);

    const mime = type?.mime || "image/jpeg";

    res.setHeader("content-Type", mime);
    res.send(imageBuffer);
  } catch (err) {
    console.error("Failed to fetch image:", err);
    res.status(500).json({ message: "Error fetching image" });
  }
});

app.post("/api/images", upload.single("image"), async (req, res) => {
  const image = req.file?.buffer;
  const name = req.file?.originalname;

  if (!image || image.length < 10) {
    return res.status(400).json({ message: "No image provided or too small" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO Images (ImageData, Name) VALUES ($1, $2) RETURNING Id",
      [image, name]
    );
    res.status(201).json({ message: "Image uploaded", id: result.rows[0].id });
  } catch (err) {
    console.error("❌ Upload error:", err.stack);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body;
  console.log("📥 Admin login attempt:", username, password);

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1 AND password = $2",
      [username, password]
    );

    console.log("🔍 DB result:", result.rows);

    if (!result.rows.length) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    return res.status(200).json({ user: result.rows[0], token: "admin-token" });
  } catch (err) {
    console.error("❌ Admin login error:", err.stack || err.message);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auth", async (req, res) => {
  const { action, username, password, email, phone } = req.body;
  try {
    if (action === "login") {
      const result = await pool.query(
        "SELECT * FROM LoginTable WHERE username = $1 AND password = $2",
        [username, password]
      );
      if (!result.rows.length) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      return res.status(200).json({ user: result.rows[0], role: "user" });
    }
    if (action === "signup") {
      const exists = await pool.query(
        "SELECT * FROM LoginTable WHERE username = $1",
        [username]
      );
      if (exists.rows.length) {
        return res.status(400).json({ message: "Username already exists" });
      }
      await pool.query(
        `INSERT INTO LoginTable (username, password, email, phone) VALUES ($1, $2, $3, $4)`,
        [username, password, email, phone]
      );
      const newUser = await pool.query(
        "SELECT * FROM LoginTable WHERE username = $1",
        [username]
      );
      return res.status(200).json({ user: newUser.rows[0], role: "user" });
    }
    return res.status(400).json({ message: "Invalid action" });
  } catch (err) {
    console.error("Auth error:", err);
    res.status(500).json({ message: "Server error" });
    console.log("Image ID:", imageId);
    console.log("Buffer size:", imageBuffer?.length);
  }
});

app.put("/api/users/:id", async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { username, password, email, phone } = req.body;
  try {
    await pool.query(
      `UPDATE LoginTable SET username = $1, password = $2, email = $3, phone = $4 WHERE id = $5`,
      [username, password, email, phone, userId]
    );
    res.status(200).json({ message: "User updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM UserWishlist WHERE UserId = $1", [userId]);
    await client.query(
      "DELETE FROM PostLikes WHERE username IN (SELECT username FROM LoginTable WHERE id = $1)",
      [userId]
    );
    await client.query(
      "DELETE FROM Comments WHERE username IN (SELECT username FROM LoginTable WHERE id = $1)",
      [userId]
    );
    await client.query("DELETE FROM LoginTable WHERE id = $1", [userId]);
    await client.query("COMMIT");
    res.status(200).json({ message: "User and related data deleted" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

app.put("/api/auth/password", async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  try {
    const check = await pool.query(
      "SELECT * FROM LoginTable WHERE id = $1 AND password = $2",
      [userId, oldPassword]
    );
    if (!check.rows.length) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }
    await pool.query("UPDATE LoginTable SET password = $1 WHERE id = $2", [
      newPassword,
      userId,
    ]);
    res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/posts", async (req, res) => {
  const username = req.query.username;

  const query = username
    ? `
      WITH liked_posts AS (
        SELECT post_id
        FROM PostLikes
        WHERE username = $1
      )
      SELECT 
        bp.id,
        bp.title,
        bp.summary,
        bp.author,
        bp.post_date,
        bp.logoId,
        bp.imageId,
        bp.likes,
        li.Name AS logoName,
        pi.Name AS imageName,
        (
          SELECT COUNT(*) 
          FROM Comments c 
          WHERE c.post_id = bp.id
        ) AS commentCount,
        CASE 
          WHEN lp.post_id IS NOT NULL THEN true 
          ELSE false 
        END::boolean AS isLiked
      FROM BlogPosts bp
      LEFT JOIN Images li ON bp.logoId = li.Id
      LEFT JOIN Images pi ON bp.imageId = pi.Id
      LEFT JOIN liked_posts lp ON lp.post_id = bp.id
      ORDER BY bp.post_date DESC;
    `
    : `
      SELECT 
        bp.id,
        bp.title,
        bp.summary,
        bp.author,
        bp.post_date,
        bp.logoId,
        bp.imageId,
        bp.likes,
        li.Name AS logoName,
        pi.Name AS imageName,
        (
          SELECT COUNT(*) 
          FROM Comments c 
          WHERE c.post_id = bp.id
        ) AS commentCount
      FROM BlogPosts bp
      LEFT JOIN Images li ON bp.logoId = li.Id
      LEFT JOIN Images pi ON bp.imageId = pi.Id
      ORDER BY bp.post_date DESC;
    `;

  try {
    const result = username
      ? await pool.query(query, [username])
      : await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch posts:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post(
  "/api/posts",
  upload.fields([{ name: "postImage" }, { name: "logoImage" }]),
  async (req, res) => {
    const { title, summary, author } = req.body;
    const postImage = req.files?.["postImage"]?.[0]?.buffer || null;
    const logoImage = req.files?.["logoImage"]?.[0]?.buffer || null;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let postImageId = null;
      let logoImageId = null;

      if (postImage) {
        const result = await client.query(
          "INSERT INTO Images (ImageData) VALUES ($1) RETURNING Id",
          [postImage]
        );
        postImageId = result.rows[0].id;
      }

      if (logoImage) {
        const result = await client.query(
          "INSERT INTO Images (ImageData) VALUES ($1) RETURNING Id",
          [logoImage]
        );
        logoImageId = result.rows[0].id;
      }

      const postResult = await client.query(
        `INSERT INTO BlogPosts (title, summary, author, post_date, imageId, logoId)
       VALUES ($1, $2, $3, NOW(), $4, $5)
       RETURNING *`,
        [title, summary, author || "Anonymous", postImageId, logoImageId]
      );

      await client.query("COMMIT");
      res
        .status(201)
        .json({ message: "Post created", post: postResult.rows[0] });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Failed to create post:", err);
      res.status(500).json({ message: "Failed to create post" });
    } finally {
      client.release();
    }
  }
);

app.put(
  "/api/posts/:id",
  upload.fields([{ name: "postImage" }]),
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { title, Summary, author } = req.body;
    const postImage = req.files?.["postImage"]?.[0]?.buffer || null;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let imageId = null;

      // Fetch existing post
      const existingPost = await client.query(
        "SELECT imageid FROM BlogPosts WHERE id = $1",
        [id]
      );

      if (!existingPost.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Post not found" });
      }

      const currentImageId = existingPost.rows[0].imageid;

      if (postImage) {
        if (currentImageId) {
          await client.query("UPDATE Images SET imagedata = $1 WHERE id = $2", [
            postImage,
            currentImageId,
          ]);
          imageId = currentImageId;
        } else {
          const imgRes = await client.query(
            "INSERT INTO Images (imagedata) VALUES ($1) RETURNING id",
            [postImage]
          );
          imageId = imgRes.rows[0].id;
        }
      }

      // Update post
      const updateQuery = `
        UPDATE BlogPosts
        SET title = $1,
            summary = $2,
            author = $3
            ${imageId !== null ? ", imageid = $4" : ""}
        WHERE id = $5
      `;

      const updateValues =
        imageId !== null
          ? [title, Summary, author, imageId, id]
          : [title, Summary, author, id];

      await client.query(updateQuery, updateValues);

      await client.query("COMMIT");
      res.json({ message: "Post updated successfully" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("❌ Error updating post:", err.stack);
      res.status(500).json({
        message: "Failed to update post",
        error: err.message,
      });
    } finally {
      client.release();
    }
  }
);

app.get("/api/comments/:postId", async (req, res) => {
  const postId = parseInt(req.params.postId, 10);
  try {
    const result = await pool.query(
      "SELECT * FROM Comments WHERE post_id = $1 ORDER BY comment_date ASC",
      [postId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch comments:", err);
    res.status(500).json({ message: "Failed to fetch comments" });
  }
});

app.post("/api/comments", async (req, res) => {
  const { post_id, username, message } = req.body;
  try {
    await pool.query(
      `INSERT INTO Comments (post_id, username, message, comment_date)
       VALUES ($1, $2, $3, NOW())`,
      [post_id, username, message]
    );
    res.status(201).json({ message: "Comment added" });
  } catch (err) {
    res.status(500).json({ message: "Failed to add comment" });
  }
});

app.get("/api/posts/:id/like", async (req, res) => {
  const postId = parseInt(req.params.id, 10);
  const { username } = req.body;

  try {
    const check = await pool.query(
      "SELECT * FROM PostLikes WHERE post_id = $1 AND username = $2",
      [postId, username]
    );

    let isLiked;
    if (check.rows.length) {
      await pool.query(
        "DELETE FROM PostLikes WHERE post_id = $1 AND username = $2",
        [postId, username]
      );
      isLiked = false;
    } else {
      await pool.query(
        "INSERT INTO PostLikes (post_id, username, liked_at) VALUES ($1, $2, NOW())",
        [postId, username]
      );
      isLiked = true;
    }

    const result = await pool.query(
      "SELECT COUNT(*) FROM PostLikes WHERE post_id = $1",
      [postId]
    );
    const likeCount = parseInt(result.rows[0].count, 10);

    await pool.query("UPDATE BlogPosts SET likes = $1 WHERE id = $2", [
      likeCount,
      postId,
    ]);

    res.status(200).json({ isLiked, likes: likeCount });
  } catch (err) {
    console.error("Like toggle failed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/liked-posts/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const result = await pool.query(
      `SELECT p.id, p.title, p.summary, p.author, p.post_date
       FROM BlogPosts p
       JOIN PostLikes pl ON p.id = pl.post_id
       WHERE pl.username = $1`,
      [username]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching liked posts:", err);
    res.status(500).json({ error: "Failed to fetch liked posts" });
  }
});

app.get("/api/user-comments/:username", async (req, res) => {
  const username = req.params.username;

  try {
    const result = await pool.query(
      `SELECT 
         c.id,
         c.post_id,
         c.username,
         c.message,
         c.comment_date,
         bp.title AS postTitle
       FROM Comments c
       JOIN BlogPosts bp ON c.post_id = bp.id
       WHERE c.username = $1
       ORDER BY c.comment_date DESC`,
      [username]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Failed to fetch user comments:", err);
    res.status(500).json({ message: "Failed to fetch user comments" });
  }
});

app.get("/api/wishlist/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId, 10);

  try {
    const result = await pool.query(
      `SELECT 
         abl.id,
         abl.name,
         abl.country,
         abl.latitude,
         abl.longitude,
         abl.emoji,
         abl.uniquething,
         abl.funfact
       FROM AdventureBucketList abl
       JOIN UserWishlist uw ON abl.id = uw.bucketitemid
       WHERE uw.userid = $1`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Wishlist fetch failed:", err);
    res.status(500).json({ message: "Failed to fetch wishlist" });
  }
});

app.post("/api/wishlist", async (req, res) => {
  const { userId, bucketItemId, isWishlist } = req.body;
  try {
    if (isWishlist) {
      await pool.query(
        `INSERT INTO UserWishlist (UserId, BucketItemId)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userId, bucketItemId]
      );
    } else {
      await pool.query(
        `DELETE FROM UserWishlist WHERE UserId = $1 AND BucketItemId = $2`,
        [userId, bucketItemId]
      );
    }
    res.json({ message: "Wishlist updated" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update wishlist" });
  }
});

app.get("/api/bucketlist", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM AdventureBucketList");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch bucket list" });
  }
});

app.post("/api/bucketlist", async (req, res) => {
  const { name, country, latitude, longitude, emoji } = req.body;
  try {
    await pool.query(
      `INSERT INTO AdventureBucketList (Name, Country, Latitude, Longitude, Emoji)
       VALUES ($1, $2, $3, $4, $5)`,
      [name, country, latitude, longitude, emoji]
    );
    res.status(201).json({ message: "Bucket item added" });
  } catch (err) {
    res.status(500).json({ message: "Failed to add bucket item" });
  }
});

app.put("/api/bucketlist/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { completed } = req.body;
  try {
    await pool.query(
      "UPDATE AdventureBucketList SET Completed = $1 WHERE Id = $2",
      [completed, id]
    );
    res.status(200).json({ message: "Bucket item updated" });
  } catch (err) {
    console.error("Update failed", err);
    res.status(500).json({ message: "Failed to update" });
  }
});

app.delete("/api/bucketlist/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await pool.query("DELETE FROM AdventureBucketList WHERE Id = $1", [id]);
    res.status(200).json({ message: "Bucket item deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete bucket item" });
  }
});

// FOOD ITEMS
app.get("/api/fooditems", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM FoodItems");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch food items" });
  }
});

app.post("/api/fooditems", upload.single("image"), async (req, res) => {
  try {
    const { name, description, location, rating } = req.body;
    const image = req.file;

    if (!name || !description || !location || rating === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let imageId = null;
    if (image && image.buffer) {
      const imageResult = await pool.query(
        "INSERT INTO Images (ImageData, Name) VALUES ($1, $2) RETURNING Id",
        [image.buffer, image.originalname]
      );
      imageId = imageResult.rows[0].id;
    }

    const result = await pool.query(
      "INSERT INTO FoodItems (name, description, location, rating, imageid) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, description, location, parseInt(rating), imageId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error inserting food item:", err.stack);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

app.put("/api/fooditems/:id", upload.single("image"), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, description, location, rating } = req.body;
  const imageBuffer = req.file?.buffer;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (imageBuffer) {
      const existing = await client.query(
        "SELECT imageid FROM FoodItems WHERE id = $1",
        [id]
      );

      if (existing.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Food item not found" });
      }

      const imageId = existing.rows[0].imageid;

      await client.query("UPDATE Images SET ImageData = $1 WHERE Id = $2", [
        imageBuffer,
        imageId,
      ]);
    }

    const updateResult = await client.query(
      `UPDATE FoodItems
       SET name = $1, description = $2, location = $3, rating = $4
       WHERE id = $5
       RETURNING *`,
      [name, description, location, parseInt(rating), id]
    );

    await client.query("COMMIT");
    res.json({ message: "Food item updated", data: updateResult.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Update food item error:", err);
    res.status(500).json({ message: "Failed to update food item" });
  } finally {
    client.release();
  }
});

app.delete("/api/fooditems/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await pool.query("DELETE FROM FoodItems WHERE Id = $1", [id]);
    res.status(200).json({ message: "Food item deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete food item" });
  }
});

app.get("/api/adventures", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM Adventures");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch adventures" });
  }
});
app.post("/api/adventures", upload.single("image"), async (req, res) => {
  const { name, description, location } = req.body;
  const image = req.file?.buffer;

  console.log("➡️ Incoming Adventure:", { name, description, location });
  if (!name || !description || !location || !image) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const imgRes = await client.query(
      `INSERT INTO Images (ImageData) VALUES ($1) RETURNING Id`,
      [image]
    );
    const imageId = imgRes.rows[0].id;

    await client.query(
      `INSERT INTO Adventures (Name, Description, Location, ImageId)
       VALUES ($1, $2, $3, $4)`,
      [name, description, location, imageId]
    );

    await client.query("COMMIT");
    res.status(201).json({ message: "Adventure added" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Adventure insert error:", err.stack);
    res.status(500).json({ message: "Failed to add adventure" });
  } finally {
    client.release();
  }
});

app.put("/api/adventures/:id", upload.single("image"), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, description, location } = req.body;
  const imageBuffer = req.file?.buffer;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (imageBuffer) {
      const existing = await client.query(
        "SELECT ImageId FROM Adventures WHERE Id = $1",
        [id]
      );

      if (existing.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Adventure not found" });
      }

      const imageId = existing.rows[0].imageid;

      await client.query("UPDATE Images SET ImageData = $1 WHERE Id = $2", [
        imageBuffer,
        imageId,
      ]);
    }

    const updateResult = await client.query(
      `UPDATE Adventures
       SET Name = $1, Description = $2, Location = $3
       WHERE Id = $4
       RETURNING *`,
      [name, description, location, id]
    );

    await client.query("COMMIT");
    res.json({ message: "Adventure updated", data: updateResult.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Update adventure error:", err);
    res.status(500).json({ message: "Failed to update adventure" });
  } finally {
    client.release();
  }
});

app.delete("/api/adventures/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await pool.query("DELETE FROM Adventures WHERE Id = $1", [id]);
    res.status(200).json({ message: "Adventure deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete adventure" });
  }
});

app.get("/api/home", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        ws.*,
        i.Name AS "ImageName",
        ENCODE(i.ImageData, 'base64') AS "imageBase64"
      FROM WebsiteSections ws
      LEFT JOIN Images i ON ws.ImageId = i.Id
      ORDER BY ws.Sort_Order ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch home sections" });
  }
});

app.post("/api/home", upload.single("image"), async (req, res) => {
  const { type, title, description, Summary1, Summary2, sort_order } = req.body;
  const image = req.file?.buffer;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let imageId = null;
    if (image) {
      const imgRes = await client.query(
        `INSERT INTO Images (ImageData) VALUES ($1) RETURNING Id`,
        [image]
      );
      imageId = imgRes.rows[0].id;
    }
    await client.query(
      `INSERT INTO WebsiteSections (Type, Title, Description, Summary1, Summary2, Sort_Order, ImageId)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [type, title, description, Summary1, Summary2, sort_order, imageId]
    );
    await client.query("COMMIT");
    res.status(201).json({ message: "Section created" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: "Failed to create home section" });
  } finally {
    client.release();
  }
});

app.put("/api/home/:id", upload.single("image"), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, description, Summary1, Summary2 } = req.body;
  const image = req.file?.buffer;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let imageId = null;
    if (image) {
      const imgRes = await client.query(
        `INSERT INTO Images (ImageData) VALUES ($1) RETURNING Id`,
        [image]
      );
      imageId = imgRes.rows[0].id;
    }
    await client.query(
      `UPDATE WebsiteSections SET Title=$1, Description=$2, Summary1=$3, Summary2=$4${
        imageId ? ", ImageId=$5" : ""
      } WHERE Id=$6`,
      imageId
        ? [title, description, Summary1, Summary2, imageId, id]
        : [title, description, Summary1, Summary2, id]
    );
    await client.query("COMMIT");
    res.status(200).json({ message: "Section updated", imageId });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: "Failed to update section" });
  } finally {
    client.release();
  }
});

app.delete("/api/home/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await pool.query("DELETE FROM WebsiteSections WHERE Id = $1", [id]);
    res.status(200).json({ message: "Section deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete section" });
  }
});

module.exports = app;
