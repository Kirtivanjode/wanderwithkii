// app.js (PostgreSQL full version)
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const pool = require("./db"); // PostgreSQL pool
const multer = require("multer");
const { Readable } = require("stream");

const upload = multer({ storage: multer.memoryStorage() });
const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// -------------------- Test DB connection --------------------
const testConnection = async () => {
  try {
    await pool.query("SELECT 1");
    console.log("Connected to PostgreSQL successfully.");
  } catch (err) {
    console.error("Database connection failed:", err);
  }
};
testConnection();

// -------------------- Helpers --------------------
const toInt = (v) => (typeof v === "string" ? parseInt(v, 10) : v);

// -------------------- Admin Login --------------------
app.post("/api/admin", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      `SELECT * FROM users WHERE username = $1 AND password = $2`,
      [username, password]
    );
    if (result.rows.length > 0) {
      res.status(200).json({ user: result.rows[0], role: "admin" });
    } else {
      res.status(401).json({ message: "Invalid admin credentials" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------- User Auth --------------------
app.post("/api/auth", async (req, res) => {
  const { action, username, password, email, phone } = req.body;
  try {
    if (action === "login") {
      const result = await pool.query(
        `SELECT * FROM logintable WHERE username = $1 AND password = $2`,
        [username, password]
      );
      if (!result.rows.length)
        return res.status(401).json({ message: "Invalid credentials" });
      return res.status(200).json({ user: result.rows[0], role: "user" });
    }

    if (action === "signup") {
      const exists = await pool.query(
        `SELECT 1 FROM logintable WHERE username = $1`,
        [username]
      );
      if (exists.rows.length)
        return res.status(400).json({ message: "Username already exists" });

      await pool.query(
        `INSERT INTO logintable (username, password, email, phone, role) VALUES ($1, $2, $3, $4, 'user')`,
        [username, password, email, phone]
      );
      const newUser = await pool.query(
        `SELECT * FROM logintable WHERE username = $1`,
        [username]
      );
      return res.status(200).json({ user: newUser.rows[0], role: "user" });
    }

    return res.status(400).json({ message: "Invalid action" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -------------------- Images --------------------
app.get("/api/images/:id", async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const result = await pool.query(
      `SELECT name, imagedata FROM images WHERE id = $1`,
      [id]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: "Image not found" });

    const image = result.rows[0];
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Disposition", `inline; filename="${image.name}"`);
    const stream = new Readable();
    stream.push(image.imagedata);
    stream.push(null);
    stream.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching image" });
  }
});

// -------------------- Posts --------------------
app.get("/api/posts", async (req, res) => {
  const username = req.query.username || null;
  try {
    const query = `
      SELECT p.id, p.title, p.summary, p.author, p.post_date, p.logoid, p.imageid,
             (SELECT COUNT(*)::int FROM comments WHERE post_id = p.id) AS commentcount,
             (SELECT COUNT(*)::int FROM postlikes WHERE post_id = p.id) AS likes,
             CASE WHEN $1::text IS NOT NULL AND EXISTS(
                 SELECT 1 FROM postlikes WHERE post_id = p.id AND username = $1
             ) THEN true ELSE false END AS isliked
      FROM blogposts p
      ORDER BY p.post_date DESC`;
    const result = await pool.query(query, [username]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching posts:", err);
    res.status(500).json({ message: "Failed to load posts" });
  }
});

app.get("/api/posts/:id", async (req, res) => {
  const id = toInt(req.params.id);
  try {
    const result = await pool.query(`SELECT * FROM blogposts WHERE id = $1`, [
      id,
    ]);
    if (!result.rows.length)
      return res.status(404).json({ message: "Post not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching post:", err);
    res.status(500).json({ message: "Failed to load post" });
  }
});

// create with optional logoImage + postImage
app.post(
  "/api/posts",
  upload.fields([{ name: "logoImage" }, { name: "postImage" }]),
  async (req, res) => {
    const { title, summary } = req.body;
    const postImage = req.files?.["postImage"]?.[0];
    const logoImage = req.files?.["logoImage"]?.[0];

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let logoId = null,
        postImageId = null;

      if (logoImage) {
        const logoRes = await client.query(
          `INSERT INTO images (name, imagedata) VALUES ($1, $2) RETURNING id`,
          [logoImage.originalname, logoImage.buffer]
        );
        logoId = logoRes.rows[0].id;
      }
      if (postImage) {
        const postRes = await client.query(
          `INSERT INTO images (name, imagedata) VALUES ($1, $2) RETURNING id`,
          [postImage.originalname, postImage.buffer]
        );
        postImageId = postRes.rows[0].id;
      }

      const result = await client.query(
        `INSERT INTO blogposts (title, summary, author, post_date, likes, logoid, imageid)
       VALUES ($1, $2, $3, NOW(), 0, $4, $5) RETURNING id`,
        [title, summary, "Wander With KI", logoId, postImageId]
      );

      await client.query("COMMIT");
      res
        .status(201)
        .json({
          message: "Post created successfully",
          postId: result.rows[0].id,
        });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error creating post:", err);
      res.status(500).json({ error: "Failed to create post" });
    } finally {
      client.release();
    }
  }
);

app.put(
  "/api/posts/:id",
  upload.fields([{ name: "logoImage" }, { name: "postImage" }]),
  async (req, res) => {
    const id = toInt(req.params.id);
    const { title, summary } = req.body;
    const postImage = req.files?.["postImage"]?.[0];
    const logoImage = req.files?.["logoImage"]?.[0];

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE blogposts SET title=$1, summary=$2 WHERE id=$3`,
        [title, summary, id]
      );

      if (postImage) {
        const imgRes = await client.query(
          `INSERT INTO images (name, imagedata) VALUES ($1, $2) RETURNING id`,
          [postImage.originalname, postImage.buffer]
        );
        await client.query(`UPDATE blogposts SET imageid=$1 WHERE id=$2`, [
          imgRes.rows[0].id,
          id,
        ]);
      }
      if (logoImage) {
        const logoRes = await client.query(
          `INSERT INTO images (name, imagedata) VALUES ($1, $2) RETURNING id`,
          [logoImage.originalname, logoImage.buffer]
        );
        await client.query(`UPDATE blogposts SET logoid=$1 WHERE id=$2`, [
          logoRes.rows[0].id,
          id,
        ]);
      }

      await client.query("COMMIT");
      res.json({ message: "Post updated successfully" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error updating post:", err);
      res.status(500).json({ error: "Failed to update post" });
    } finally {
      client.release();
    }
  }
);

app.delete("/api/posts/:id", async (req, res) => {
  const id = toInt(req.params.id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM postlikes WHERE post_id=$1`, [id]);
    await client.query(`DELETE FROM comments WHERE post_id=$1`, [id]);
    const del = await client.query(`DELETE FROM blogposts WHERE id=$1`, [id]);
    await client.query("COMMIT");
    if (del.rowCount === 0)
      return res.status(404).json({ message: "Post not found" });
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting post:", err);
    res.status(500).json({ message: "Failed to delete post" });
  } finally {
    client.release();
  }
});

// like toggle
app.post("/api/posts/:id/like", async (req, res) => {
  const id = toInt(req.params.id);
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: "username required" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const exists = await client.query(
      `SELECT 1 FROM postlikes WHERE post_id=$1 AND username=$2`,
      [id, username]
    );
    if (exists.rows.length) {
      await client.query(
        `DELETE FROM postlikes WHERE post_id=$1 AND username=$2`,
        [id, username]
      );
      await client.query("COMMIT");
      return res.json({ liked: false });
    } else {
      await client.query(
        `INSERT INTO postlikes (post_id, username, liked_at) VALUES ($1,$2,NOW())`,
        [id, username]
      );
      await client.query("COMMIT");
      return res.json({ liked: true });
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error toggling like:", err);
    res.status(500).json({ message: "Failed to toggle like" });
  } finally {
    client.release();
  }
});

// -------------------- Comments --------------------
app.get("/api/comments/:postId", async (req, res) => {
  try {
    const postId = toInt(req.params.postId);
    const result = await pool.query(
      `SELECT * FROM comments WHERE post_id = $1 ORDER BY comment_date DESC`,
      [postId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching comments:", err);
    res.status(500).json({ message: "Failed to load comments" });
  }
});

app.post("/api/comments", async (req, res) => {
  const { post_id, username, message } = req.body;
  if (!post_id || !username || !message)
    return res.status(400).json({ message: "All fields required" });
  try {
    await pool.query(
      `INSERT INTO comments (post_id, username, message, comment_date) VALUES ($1, $2, $3, NOW())`,
      [post_id, username, message]
    );
    res.status(201).json({ message: "Comment added successfully" });
  } catch (err) {
    console.error("Error adding comment:", err);
    res.status(500).json({ message: "Failed to add comment" });
  }
});

app.delete("/api/comments/:id", async (req, res) => {
  const id = toInt(req.params.id);
  try {
    const result = await pool.query(`DELETE FROM comments WHERE id=$1`, [id]);
    if (result.rowCount === 0)
      return res.status(404).json({ message: "Comment not found" });
    res.json({ message: "Comment deleted successfully" });
  } catch (err) {
    console.error("Error deleting comment:", err);
    res.status(500).json({ message: "Failed to delete comment" });
  }
});

// -------------------- Bucket List --------------------
app.get("/api/bucketlist", async (req, res) => {
  const { completed } = req.query;
  try {
    let query = "SELECT * FROM adventurebucketlist";
    const values = [];
    if (completed !== undefined) {
      query += " WHERE completed = $1";
      values.push(completed === "true");
    }
    query += " ORDER BY id";
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching bucket list items:", err);
    res.status(500).send("Failed to fetch bucket list items");
  }
});

app.post("/api/bucketlist", async (req, res) => {
  const {
    name,
    emoji,
    country,
    latitude,
    longitude,
    funfact,
    uniquething,
    iswishlist,
  } = req.body;
  try {
    await pool.query(
      `INSERT INTO adventurebucketlist (name, emoji, country, latitude, longitude, funfact, uniquething, iswishlist)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        name,
        emoji,
        country,
        latitude,
        longitude,
        funfact,
        uniquething,
        !!iswishlist,
      ]
    );
    res.status(201).json({ message: "Bucket item added" });
  } catch (err) {
    console.error("Failed to insert bucket item:", err);
    res.status(500).json({ message: "Failed to insert bucket item" });
  }
});

app.put("/api/bucketlist/:id", async (req, res) => {
  const id = toInt(req.params.id);
  const {
    name,
    emoji,
    country,
    latitude,
    longitude,
    funfact,
    uniquething,
    completed,
    iswishlist,
  } = req.body;
  try {
    const q = `UPDATE adventurebucketlist 
               SET name=$1, emoji=$2, country=$3, latitude=$4, longitude=$5, funfact=$6, uniquething=$7, completed=$8, iswishlist=$9
               WHERE id=$10`;
    const vals = [
      name,
      emoji,
      country,
      latitude,
      longitude,
      funfact,
      uniquething,
      completed,
      iswishlist,
      id,
    ];
    await pool.query(q, vals);
    res.json({ message: "Bucket list item updated" });
  } catch (err) {
    console.error("Failed to update bucket item:", err);
    res.status(500).json({ message: "Failed to update bucket item" });
  }
});

app.delete("/api/bucketlist/:id", async (req, res) => {
  const id = toInt(req.params.id);
  try {
    await pool.query(`DELETE FROM adventurebucketlist WHERE id=$1`, [id]);
    res.json({ message: "Bucket list item deleted" });
  } catch (err) {
    console.error("Failed to delete bucket item:", err);
    res.status(500).json({ message: "Failed to delete bucket list item" });
  }
});

// -------------------- Food Items --------------------
app.get("/api/fooditems", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.id, f.name, f.description, f.location, f.rating, f.imageid, i.name AS imagename, i.imagedata
       FROM fooditems f LEFT JOIN images i ON f.imageid = i.id ORDER BY f.id`
    );
    const foodItems = result.rows.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      location: item.location,
      rating: item.rating,
      imageid: item.imageid,
      imagename: item.imagename,
      imagebase64: item.imagedata
        ? `data:image/jpeg;base64,${item.imagedata.toString("base64")}`
        : null,
    }));
    res.json(foodItems);
  } catch (err) {
    console.error("Error fetching food items:", err);
    res.status(500).json({ message: "Failed to get food items" });
  }
});

app.post("/api/fooditems", upload.single("image"), async (req, res) => {
  const { name, description, location, rating } = req.body;
  if (!req.file) return res.status(400).json({ message: "Image required" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const imgRes = await client.query(
      `INSERT INTO images (name, imagedata) VALUES ($1,$2) RETURNING id`,
      [req.file.originalname, req.file.buffer]
    );
    await client.query(
      `INSERT INTO fooditems (name, description, location, rating, imageid) VALUES ($1,$2,$3,$4,$5)`,
      [name, description, location, rating || 0, imgRes.rows[0].id]
    );
    await client.query("COMMIT");
    res.status(201).json({ message: "Food item created" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to create food item:", err);
    res.status(500).json({ message: "Failed to create food item" });
  } finally {
    client.release();
  }
});

app.put("/api/fooditems/:id", upload.single("image"), async (req, res) => {
  const id = toInt(req.params.id);
  const { name, description, location, rating } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE fooditems SET name=$1, description=$2, location=$3, rating=$4 WHERE id=$5`,
      [name, description, location, rating, id]
    );
    if (req.file) {
      const imgRes = await client.query(
        `INSERT INTO images (name, imagedata) VALUES ($1,$2) RETURNING id`,
        [req.file.originalname, req.file.buffer]
      );
      await client.query(`UPDATE fooditems SET imageid=$1 WHERE id=$2`, [
        imgRes.rows[0].id,
        id,
      ]);
    }
    await client.query("COMMIT");
    res.json({ message: "Food item updated" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to update food item:", err);
    res.status(500).json({ message: "Failed to update food item" });
  } finally {
    client.release();
  }
});

app.delete("/api/fooditems/:id", async (req, res) => {
  const id = toInt(req.params.id);
  try {
    await pool.query(`DELETE FROM fooditems WHERE id=$1`, [id]);
    res.json({ message: "Food item deleted" });
  } catch (err) {
    console.error("Failed to delete food item:", err);
    res.status(500).json({ message: "Failed to delete food item" });
  }
});

// -------------------- Adventures --------------------
app.get("/api/adventures", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.name, a.description, a.location, a.imageid, i.name AS imagename, i.imagedata
       FROM adventures a LEFT JOIN images i ON a.imageid = i.id ORDER BY a.id`
    );
    const adventures = result.rows.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      location: item.location,
      imageid: item.imageid,
      imagename: item.imagename,
      imagebase64: item.imagedata
        ? `data:image/jpeg;base64,${item.imagedata.toString("base64")}`
        : null,
    }));
    res.json(adventures);
  } catch (err) {
    console.error("Error fetching adventures:", err);
    res.status(500).json({ message: "Failed to get adventures" });
  }
});

app.post("/api/adventures", upload.single("image"), async (req, res) => {
  const { name, description, location } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let imageId = null;
    if (req.file) {
      const imgRes = await client.query(
        `INSERT INTO images (name, imagedata) VALUES ($1,$2) RETURNING id`,
        [req.file.originalname, req.file.buffer]
      );
      imageId = imgRes.rows[0].id;
    }
    await client.query(
      `INSERT INTO adventures (name, description, location, imageid) VALUES ($1,$2,$3,$4)`,
      [name, description, location, imageId]
    );
    await client.query("COMMIT");
    res.status(201).json({ message: "Adventure created" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to create adventure:", err);
    res.status(500).json({ message: "Failed to create adventure" });
  } finally {
    client.release();
  }
});

app.put("/api/adventures/:id", upload.single("image"), async (req, res) => {
  const id = toInt(req.params.id);
  const { name, description, location } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE adventures SET name=$1, description=$2, location=$3 WHERE id=$4`,
      [name, description, location, id]
    );
    if (req.file) {
      const imgRes = await client.query(
        `INSERT INTO images (name, imagedata) VALUES ($1,$2) RETURNING id`,
        [req.file.originalname, req.file.buffer]
      );
      await client.query(`UPDATE adventures SET imageid=$1 WHERE id=$2`, [
        imgRes.rows[0].id,
        id,
      ]);
    }
    await client.query("COMMIT");
    res.json({ message: "Adventure updated" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to update adventure:", err);
    res.status(500).json({ message: "Failed to update adventure" });
  } finally {
    client.release();
  }
});

app.delete("/api/adventures/:id", async (req, res) => {
  const id = toInt(req.params.id);
  try {
    await pool.query(`DELETE FROM adventures WHERE id=$1`, [id]);
    res.json({ message: "Adventure deleted" });
  } catch (err) {
    console.error("Failed to delete adventure:", err);
    res.status(500).json({ message: "Failed to delete adventure" });
  }
});

// -------------------- Home Sections --------------------
app.get("/api/home", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ws.id, ws.type, ws.title, ws.description, ws.content1, ws.content2, ws.sort_order, ws.imageid, i.name AS imagename, i.imagedata
       FROM websitesections ws LEFT JOIN images i ON ws.imageid = i.id ORDER BY ws.sort_order ASC`
    );
    const sections = result.rows.map((s) => ({
      id: s.id,
      type: s.type,
      title: s.title,
      description: s.description,
      content1: s.content1,
      content2: s.content2,
      sort_order: s.sort_order,
      imageid: s.imageid,
      imagename: s.imagename,
      imagebase64: s.imagedata
        ? `data:image/jpeg;base64,${s.imagedata.toString("base64")}`
        : null,
    }));
    res.json(sections);
  } catch (err) {
    console.error("Failed to fetch website sections:", err);
    res.status(500).send("Failed to fetch website sections");
  }
});

app.post("/api/home", upload.single("image"), async (req, res) => {
  const { type, title, description, content1, content2, sort_order } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let imageId = null;
    if (req.file) {
      const imgRes = await client.query(
        `INSERT INTO images (name, imagedata) VALUES ($1,$2) RETURNING id`,
        [req.file.originalname, req.file.buffer]
      );
      imageId = imgRes.rows[0].id;
    }
    await client.query(
      `INSERT INTO websitesections (type,title,description,content1,content2,sort_order,imageid)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [type, title, description, content1, content2, sort_order, imageId]
    );
    await client.query("COMMIT");
    res.status(201).json({ message: "Section created successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to create section:", err);
    res.status(500).json({ error: "Failed to create section" });
  } finally {
    client.release();
  }
});

app.put("/api/home/:id", upload.single("image"), async (req, res) => {
  const id = toInt(req.params.id);
  const { title, description, content1, content2, sort_order } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE websitesections SET title=$1, description=$2, content1=$3, content2=$4, sort_order=$5 WHERE id=$6`,
      [title, description, content1, content2, sort_order, id]
    );
    if (req.file) {
      const imgRes = await client.query(
        `INSERT INTO images (name, imagedata) VALUES ($1,$2) RETURNING id`,
        [req.file.originalname, req.file.buffer]
      );
      await client.query(`UPDATE websitesections SET imageid=$1 WHERE id=$2`, [
        imgRes.rows[0].id,
        id,
      ]);
    }
    await client.query("COMMIT");
    res.json({ message: "Section updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to update section:", err);
    res.status(500).json({ message: "Failed to update section" });
  } finally {
    client.release();
  }
});

app.delete("/api/home/:id", async (req, res) => {
  const id = toInt(req.params.id);
  try {
    await pool.query(`DELETE FROM websitesections WHERE id=$1`, [id]);
    res.json({ message: "Section deleted successfully" });
  } catch (err) {
    console.error("Failed to delete section:", err);
    res.status(500).json({ message: "Failed to delete section" });
  }
});

// -------------------- Wishlist & Activity --------------------
app.get("/api/wishlist/:username", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id, b.name, b.country, b.latitude, b.longitude, b.emoji, b.funfact, b.uniquething
       FROM userwishlist uw
       INNER JOIN adventurebucketlist b ON uw.bucketitemid = b.id
       INNER JOIN logintable u ON uw.userid = u.id
       WHERE u.username = $1`,
      [req.params.username]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching wishlist:", err);
    res.status(500).send("Server error fetching wishlist");
  }
});

app.get("/api/liked-posts/:username", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.title, p.summary, p.post_date, l.liked_at
       FROM postlikes l INNER JOIN blogposts p ON l.post_id = p.id
       WHERE l.username = $1
       ORDER BY l.liked_at DESC`,
      [req.params.username]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching liked posts:", err);
    res.status(500).send("Server error fetching liked posts");
  }
});

app.get("/api/user-comments/:username", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.post_id, c.message, c.comment_date, p.title AS posttitle
       FROM comments c INNER JOIN blogposts p ON c.post_id = p.id
       WHERE c.username = $1 ORDER BY c.comment_date DESC`,
      [req.params.username]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching user comments:", err);
    res.status(500).send("Server error fetching comments");
  }
});

module.exports = app;
