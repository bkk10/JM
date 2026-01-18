// server.js - VERCEL COMPATIBLE VERSION
const express = require('express');
const Database = require('better-sqlite3');
const multer = require('multer');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const fs = require('fs');

const app = express();

// ==================== CONFIGURATION ====================
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(expressLayouts);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files
app.use('/css', express.static(path.join(__dirname, 'public/css'), {
  maxAge: '1y',
  setHeaders: (res, path) => {
    res.setHeader('Content-Type', 'text/css');
  }
}));

app.use('/js', express.static(path.join(__dirname, 'public/js'), {
  maxAge: '1y',
  setHeaders: (res, path) => {
    res.setHeader('Content-Type', 'application/javascript');
  }
}));

app.use('/images', express.static(path.join(__dirname, 'public/images'), {
  maxAge: '1y'
}));

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'), {
  maxAge: '1y'
}));

app.use(express.static(path.join(__dirname, 'public')));

// Simple session simulation
let adminLoggedIn = false;

// ==================== DATABASE ====================
// For Vercel, use in-memory database or create DB file in /tmp
const dbPath = process.env.VERCEL ? '/tmp/jedimedical.db' : './data/jedimedical.db';

// Create data directory if it doesn't exist (for local)
if (!process.env.VERCEL && !fs.existsSync('./data')) {
  fs.mkdirSync('./data', { recursive: true });
}

const db = new Database(dbPath);

// Initialize tables
try {
  // Create tables using exec with options object
  const initSQL = `
    CREATE TABLE IF NOT EXISTS gallery_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      caption TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      excerpt TEXT,
      author TEXT DEFAULT 'Admin',
      status TEXT DEFAULT 'published',
      featured_image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS content (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS section_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section TEXT NOT NULL,
      filename TEXT NOT NULL,
      caption TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS site_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT,
      user_agent TEXT,
      page_visited TEXT,
      referrer TEXT,
      visit_date DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contact_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      phone TEXT,
      message TEXT,
      submission_date DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Execute all SQL statements
  db.exec(initSQL);

  // Default content
  const defaultContent = {
    'hero_kicker': 'Level 3 • Kapsoya, Ainabkoi · Uasin Gishu',
    'hero_title': 'Healthcare that feels personal—delivered with precision.',
    'hero_intro': 'JediCare Medical centre is a trusted Level 3 clinic serving families and professionals in Kapsoya. We combine experienced clinicians with modern diagnostics and patient-first service. Our optician desk helps you see better—with frames you will love.',
    'hero_badge1': 'Open and fully operational',
    'hero_badge2': 'Modern diagnostics & imaging',
    'hero_badge3': 'Optician services & prescription glasses',
    'hero_badge4': 'Powered by EasyClinic operations',
    'why_title': 'Why patients choose Jedi',
    'why_card1_title': 'Experienced Team',
    'why_card1_body': 'Clinicians with broad hands-on experience, focused on practical, effective care.',
    'why_card2_title': 'Modern Equipment',
    'why_card2_body': 'From labs to imaging, we invest in tools that improve accuracy and outcomes.',
    'why_card3_title': 'Clean & Safe',
    'why_card3_body': 'Strict hygiene protocols for a calm, safe environment at every visit.',
    'about_title': 'About Jedi Medical',
    'about_body1': 'JediCare Medical centre is a Level 3 clinic recognized for precise, patient-centered care. We serve the Kapsoya ward in Ainabkoi constituency, Uasin Gishu, with an experienced team and a calm, well-kept facility. Our approach blends practical medicine with modern diagnostics—so you feel informed and supported at every step.',
    'about_body2': 'With EasyClinic helping streamline operations, we stay focused on what matters most: your care, your comfort, and dependable outcomes.',
    'contact_title': 'Book an Appointment',
    'contact_intro': 'Looking for a reliable private clinic near you in Uasin Gishu? JediCare Medical centre is open and ready to help. Reach out and our team will guide you to the right service, including our in-house optician desk for prescriptions and glasses.',
    'contact_note': 'Prefer a call? Add your phone number—we will get back promptly.'
  };

  // Insert default content
  const insertStmt = db.prepare('INSERT OR IGNORE INTO content (key, value) VALUES (?, ?)');
  const insertMany = db.transaction((items) => {
    for (const [key, value] of Object.entries(items)) {
      insertStmt.run(key, value);
    }
  });
  
  insertMany(defaultContent);

  // Default blog posts (for fresh deployments)
  const defaultBlogPosts = [
    {
      title: 'Preventive healthcare',
      slug: 'preventive-healthcare',
      excerpt: '5 Essential Preventive Health Checks',
      content: 'Discover key health screenings for early detection and better health. Regular preventive care is the foundation of long-term wellness and can catch potential health issues before they become serious problems.',
      author: 'Admin',
      status: 'published'
    },
    {
      title: 'Eye care',
      slug: 'eye-care',
      excerpt: 'Protecting Your Vision',
      content: 'Learn strategies to reduce digital eye strain and maintain healthy vision. In today\'s digital world, protecting your eyes is more important than ever. Our comprehensive eye care services help you maintain optimal vision health.',
      author: 'Admin',
      status: 'published'
    },
    {
      title: 'Child health',
      slug: 'child-health',
      excerpt: 'Children\'s Health Foundation',
      content: 'Essential healthcare tips for children\'s development and wellbeing. From vaccinations to growth monitoring, we provide comprehensive pediatric care to ensure your children grow up healthy and strong.',
      author: 'Admin',
      status: 'published'
    }
  ];

  // Check if blog posts table is empty
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM blog_posts');
  const row = countStmt.get();
  
  if (row.count === 0) {
    const insertPostStmt = db.prepare(
      'INSERT INTO blog_posts (title, slug, excerpt, content, author, status) VALUES (?, ?, ?, ?, ?, ?)'
    );
    
    const insertPosts = db.transaction((posts) => {
      for (const post of posts) {
        insertPostStmt.run(
          post.title, 
          post.slug, 
          post.excerpt, 
          post.content, 
          post.author, 
          post.status
        );
      }
    });
    
    insertPosts(defaultBlogPosts);
  }

  console.log('✅ Database initialized successfully');

} catch (error) {
  console.error('❌ Database initialization error:', error);
  // Continue anyway - the app should still work without database
}

// ==================== FILE UPLOAD ====================
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// ==================== SIMPLE AUTH ====================
const ADMIN_PASSWORD = 'admin123';

const requireAuth = (req, res, next) => {
  if (adminLoggedIn) {
    return next();
  }
  res.redirect('/admin/login');
};

// ==================== HELPER FUNCTIONS ====================
function getAllContent() {
  try {
    const stmt = db.prepare('SELECT key, value FROM content');
    const rows = stmt.all();
    const content = {};
    rows.forEach(row => content[row.key] = row.value);
    return content;
  } catch (error) {
    console.error('Error getting content:', error);
    return {};
  }
}

function getSectionImages() {
  try {
    const stmt = db.prepare('SELECT * FROM section_images ORDER BY section, created_at DESC');
    const rows = stmt.all();
    
    const imagesBySection = {};
    rows.forEach(img => {
      if (!imagesBySection[img.section]) {
        imagesBySection[img.section] = [];
      }
      imagesBySection[img.section].push(img);
    });
    
    return imagesBySection;
  } catch (error) {
    console.error('Error getting section images:', error);
    return {};
  }
}

// ==================== ANALYTICS MIDDLEWARE ====================
app.use((req, res, next) => {
  if (!req.path.startsWith('/admin') && !req.path.startsWith('/css') && 
      !req.path.startsWith('/js') && !req.path.startsWith('/uploads')) {
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
    
    // FIXED: Use synchronous better-sqlite3 syntax
    const stmt = db.prepare('INSERT INTO site_visits (ip_address, user_agent, page_visited, referrer) VALUES (?, ?, ?, ?)');
    stmt.run(
      clientIP,
      req.headers['user-agent'] || '',
      req.path,
      req.headers['referer'] || ''
    );
  }
  next();
});

// ==================== PUBLIC ROUTES ====================

// Home page
app.get('/', (req, res) => {
  try {
    const content = getAllContent();
    
    // Get gallery images for preview
    const galleryStmt = db.prepare('SELECT * FROM gallery_images ORDER BY created_at DESC LIMIT 6');
    const galleryImages = galleryStmt.all();

    // Get blog posts for preview - FIXED: Use single quotes for string literal
    const blogStmt = db.prepare("SELECT * FROM blog_posts WHERE status = 'published' ORDER BY created_at DESC LIMIT 3");
    const blogPosts = blogStmt.all();

    // Get section images for hero section
    const imagesBySection = getSectionImages();
    
    res.render('index', {
      content,
      galleryImages,
      blogPosts,
      imagesBySection,
      active: 'home',
    });
  } catch (error) {
    console.error('Home error:', error);
    res.status(500).send('Server error');
  }
});

// Gallery page
app.get('/gallery', (req, res) => {
  try {
    const content = getAllContent();
    const stmt = db.prepare('SELECT * FROM gallery_images ORDER BY created_at DESC');
    const images = stmt.all();
    
    res.render('gallery', {
      content,
      images,
      active: 'gallery'
    });
  } catch (error) {
    console.error('Gallery error:', error);
    res.status(500).send('Server error');
  }
});

// Blog page
app.get('/blog', (req, res) => {
  try {
    const content = getAllContent();
    // FIXED: Use single quotes for string literal
    const stmt = db.prepare("SELECT * FROM blog_posts WHERE status = 'published' ORDER BY created_at DESC");
    const posts = stmt.all();
    
    const imagesBySection = getSectionImages();
    
    res.render('blog', {
      content,
      posts,
      imagesBySection,
      active: 'blog'
    });
  } catch (error) {
    console.error('Blog error:', error);
    res.status(500).send('Server error');
  }
});

// Single blog post
app.get('/blog/:slug', (req, res) => {
  try {
    // FIXED: Use single quotes for string literal
    const stmt = db.prepare("SELECT * FROM blog_posts WHERE slug = ? AND status = 'published'");
    const post = stmt.get(req.params.slug);
    
    if (!post) {
      return res.status(404).send('Blog post not found');
    }
    
    const content = getAllContent();
    
    res.render('blog-post', {
      content,
      post,
      active: 'blog'
    });
  } catch (error) {
    console.error('Blog post error:', error);
    res.status(500).send('Server error');
  }
});

// Contact form submission
app.post('/contact', (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    
    const stmt = db.prepare('INSERT INTO contact_submissions (name, email, phone, message) VALUES (?, ?, ?, ?)');
    stmt.run(name, email, phone, message);
    
    res.redirect('/#contact?success=1');
  } catch (error) {
    console.error('Contact form error:', error);
    res.redirect('/#contact?error=1');
  }
});

// ==================== ADMIN ROUTES ====================
app.get('/admin/login', (req, res) => {
  if (adminLoggedIn) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { error: null, layout: false });
});

app.post('/admin/login', (req, res) => {
  try {
    const { password } = req.body;
    
    if (password === ADMIN_PASSWORD) {
      adminLoggedIn = true;
      return res.redirect('/admin/dashboard');
    }
    
    res.render('admin/login', { error: 'Invalid password', layout: false });
  } catch (error) {
    console.error('Login error:', error);
    res.render('admin/login', { error: 'Server error', layout: false });
  }
});

app.post('/admin/logout', (req, res) => {
  adminLoggedIn = false;
  res.redirect('/admin/login');
});

app.get('/admin/dashboard', requireAuth, (req, res) => {
  try {
    const imagesCountStmt = db.prepare('SELECT COUNT(*) as count FROM gallery_images');
    const imagesCount = imagesCountStmt.get().count;
    
    const postsCountStmt = db.prepare('SELECT COUNT(*) as count FROM blog_posts');
    const postsCount = postsCountStmt.get().count;
    
    const totalVisitsStmt = db.prepare('SELECT COUNT(*) as count FROM site_visits');
    const totalVisits = totalVisitsStmt.get().count;
    
    const todayVisitsStmt = db.prepare("SELECT COUNT(*) as count FROM site_visits WHERE DATE(visit_date) = DATE('now')");
    const todayVisits = todayVisitsStmt.get().count;
    
    const contactsStmt = db.prepare('SELECT COUNT(*) as count FROM contact_submissions');
    const contacts = contactsStmt.get().count;
    
    const recentImagesStmt = db.prepare('SELECT * FROM gallery_images ORDER BY created_at DESC LIMIT 5');
    const recentImages = recentImagesStmt.all();
    
    const recentContactsStmt = db.prepare('SELECT * FROM contact_submissions ORDER BY submission_date DESC LIMIT 5');
    const recentContacts = recentContactsStmt.all();
    
    res.render('admin/dashboard-sidebar', {
      title: 'Dashboard',
      counts: {
        services: 6,
        posts: postsCount,
        images: imagesCount,
        team: 0,
        visits: totalVisits,
        todayVisits: todayVisits,
        contacts: contacts
      },
      recentImages,
      recentContacts,
      active: 'dashboard',
      layout: 'admin/layout-sidebar'
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Server error');
  }
});

app.get('/admin/content', requireAuth, (req, res) => {
  const content = getAllContent();
  res.render('admin/content-sidebar', {
    title: 'Edit Content',
    content,
    active: 'content',
    layout: 'admin/layout-sidebar'
  });
});

app.post('/admin/content', requireAuth, (req, res) => {
  try {
    const stmt = db.prepare('INSERT OR REPLACE INTO content (key, value) VALUES (?, ?)');
    
    for (const [key, value] of Object.entries(req.body)) {
      stmt.run(key, value);
    }
    res.redirect('/admin/content?success=1');
  } catch (error) {
    console.error('Save content error:', error);
    res.redirect('/admin/content?error=1');
  }
});

app.get('/admin/section-images', requireAuth, (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM section_images ORDER BY section, created_at DESC');
    const sectionImages = stmt.all();
    
    const imagesBySection = {};
    sectionImages.forEach(img => {
      if (!imagesBySection[img.section]) {
        imagesBySection[img.section] = [];
      }
      imagesBySection[img.section].push(img);
    });
    
    res.render('admin/section-images-sidebar', {
      title: 'Section Images Management',
      imagesBySection,
      active: 'section-images',
      layout: 'admin/layout-sidebar'
    });
  } catch (error) {
    console.error('Section images error:', error);
    res.status(500).send('Server error');
  }
});

app.post('/admin/section-images/upload', requireAuth, upload.single('image'), (req, res) => {
  try {
    const { section, caption } = req.body;
    if (req.file && section) {
      const stmt = db.prepare('INSERT INTO section_images (section, filename, caption) VALUES (?, ?, ?)');
      stmt.run(section, req.file.originalname, caption || '');
    }
    res.redirect('/admin/section-images?success=1');
  } catch (error) {
    console.error('Upload section image error:', error);
    res.redirect('/admin/section-images?error=1');
  }
});

app.get('/admin/gallery', requireAuth, (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM gallery_images ORDER BY created_at DESC');
    const images = stmt.all();
    
    res.render('admin/gallery-sidebar', {
      title: 'Gallery Management',
      images,
      success: req.query.success,
      error: req.query.error,
      active: 'gallery',
      layout: 'admin/layout-sidebar'
    });
  } catch (error) {
    console.error('Gallery error:', error);
    res.status(500).send('Server error');
  }
});

app.post('/admin/gallery/upload', requireAuth, upload.single('image'), (req, res) => {
  try {
    const { caption } = req.body;
    if (req.file) {
      const stmt = db.prepare('INSERT INTO gallery_images (filename, caption) VALUES (?, ?)');
      stmt.run(req.file.originalname, caption || '');
    }
    res.redirect('/admin/gallery?success=1');
  } catch (error) {
    console.error('Upload error:', error);
    res.redirect('/admin/gallery?error=Upload failed');
  }
});

app.post('/admin/gallery/delete/:id', requireAuth, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM gallery_images WHERE id = ?');
    stmt.run(req.params.id);
    res.redirect('/admin/gallery?success=1');
  } catch (error) {
    console.error('Delete error:', error);
    res.redirect('/admin/gallery?error=Delete failed');
  }
});

app.get('/admin/blog', requireAuth, (req, res) => {
  const stmt = db.prepare('SELECT * FROM blog_posts ORDER BY created_at DESC');
  const posts = stmt.all();
  
  res.render('admin/blog', {
    title: 'Blog Management',
    posts,
    active: 'blog',
    layout: 'admin/layout-sidebar'
  });
});

app.get('/admin/blog/new', requireAuth, (req, res) => {
  res.render('admin/blog-new', {
    title: 'New Blog Post - Admin',
    active: 'blog',
    layout: 'admin/layout-sidebar'
  });
});

app.post('/admin/blog/create', requireAuth, (req, res) => {
  try {
    const { title, slug, author, excerpt, content, featured_image, status } = req.body;
    
    if (!title || !author || !content) {
      return res.redirect('/admin/blog/new?error=Title, Author, and Content are required');
    }
    
    let postSlug = slug;
    if (!postSlug || postSlug.trim() === '') {
      postSlug = title.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-')
        .trim();
    }
    
    // Check if slug exists
    const checkStmt = db.prepare('SELECT id FROM blog_posts WHERE slug = ?');
    const existingPost = checkStmt.get(postSlug);
    
    if (existingPost) {
      return res.redirect('/admin/blog/new?error=Slug already exists. Please use a different title.');
    }
    
    // Create new post
    const insertStmt = db.prepare(
      'INSERT INTO blog_posts (title, slug, excerpt, content, author, status, featured_image) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    
    insertStmt.run(
      title, 
      postSlug, 
      excerpt, 
      content, 
      author || 'Admin', 
      status || 'published', 
      featured_image
    );
    
    res.redirect('/admin/blog?success=Post created successfully!');
  } catch (error) {
    console.error('Error creating blog post:', error);
    res.redirect('/admin/blog/new?error=Error creating post: ' + error.message);
  }
});

app.get('/admin/blog/edit/:id', requireAuth, (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM blog_posts WHERE id = ?');
    const post = stmt.get(req.params.id);
    
    if (!post) {
      return res.redirect('/admin/blog?error=Post not found');
    }
    
    res.render('admin/blog-edit', {
      title: 'Edit Blog Post - Admin',
      active: 'blog',
      post,
      layout: 'admin/layout-sidebar'
    });
  } catch (error) {
    console.error('Error loading edit blog page:', error);
    res.redirect('/admin/blog?error=Cannot load edit form');
  }
});

app.post('/admin/blog/update/:id', requireAuth, (req, res) => {
  try {
    const { title, slug, author, excerpt, content, featured_image, status } = req.body;
    const postId = req.params.id;
    
    let postSlug = slug;
    if (!postSlug || postSlug.trim() === '') {
      postSlug = title.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-')
        .trim();
    }
    
    const updateStmt = db.prepare(
      'UPDATE blog_posts SET title = ?, slug = ?, excerpt = ?, content = ?, author = ?, status = ?, featured_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );
    
    updateStmt.run(
      title, 
      postSlug, 
      excerpt, 
      content, 
      author || 'Admin', 
      status || 'published', 
      featured_image, 
      postId
    );
    
    res.redirect('/admin/blog?success=Post updated successfully!');
  } catch (error) {
    console.error('Error updating blog post:', error);
    res.redirect(`/admin/blog/edit/${req.params.id}?error=Error updating post`);
  }
});

app.post('/admin/blog/delete/:id', requireAuth, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM blog_posts WHERE id = ?');
    stmt.run(req.params.id);
    res.redirect('/admin/blog?success=Post deleted successfully!');
  } catch (error) {
    console.error('Error deleting blog post:', error);
    res.redirect('/admin/blog?error=Error deleting post');
  }
});

// ==================== ERROR HANDLING ====================
app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Internal server error');
});

// ==================== EXPORT FOR VERCEL ====================
module.exports = app;

// ==================== START SERVER ====================
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`🔐 Admin: http://localhost:${PORT}/admin/login`);
    console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
  });
}