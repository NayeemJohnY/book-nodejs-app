const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// --------------------------
// 🔐 Authentication Middleware
// --------------------------

function requireAuth(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'Unauthorized. No token provided.' });
    next();
}

function requireAdmin(req, res, next) {
    const token = req.headers['authorization'];
    if (token !== 'Bearer admin-token') {
        return res.status(403).json({ error: 'Forbidden. Admin access required.' });
    }
    next();
}

// --------------------------
// 📊 Logger Middleware
// --------------------------

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
        console.log(`[${req.method}] ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
    });
    next();
});

// --------------------------
// 🚦 Rate Limiting
// --------------------------

const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 15,
    message: { error: 'Too many requests. Slow down.' }
});

app.use('/api/books', limiter);

// --------------------------
// 📘 Book Data
// --------------------------

let books = [
    { id: 1, title: '1984', author: 'George Orwell' },
    { id: 2, title: 'The Hobbit', author: 'J.R.R. Tolkien' }
];

// --------------------------
// 📚 Routes
// --------------------------


// GET all books with pagination
app.get('/api/books', (req, res) => {
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '10');
    const start = (page - 1) * limit;
    const paginated = books.slice(start, start + limit);
    res.status(200).json(paginated);
});

// GET books by search
app.get('/api/books/search', (req, res) => {
    const { title, author } = req.query;

    if (!title && !author) {
        return res.status(400).json({ error: 'Please provide at least a title or author for search' });
    }

    const filteredBooks = books.filter(book => {
        const matchesTitle = title
            ? book.title.toLowerCase().includes(title.toLowerCase())
            : true;

        const matchesAuthor = author
            ? book.author.toLowerCase().includes(author.toLowerCase())
            : true;

        return matchesTitle && matchesAuthor;
    });

    if (filteredBooks.length == 0) {
        return res.status(404).json({ error: "Books not found for search" })
    }

    res.status(200).json(filteredBooks);
});

// GET book by ID
app.get('/api/books/:id', (req, res) => {
    const book = books.find(b => b.id === parseInt(req.params.id));
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.status(200).json(book);
});

// POST new book (requires auth)
app.post('/api/books', requireAuth, (req, res) => {
    const { id, title, author } = req.body;
    if (id) {
        return res.status(400).json({ error: 'ID must not be provided when creating a book' });
    }

    if (!title || !author) {
        return res.status(400).json({ error: 'Both title and author are required.' });
    }

    const duplicate = books.find(b =>
        b.title.toLowerCase() === title.toLowerCase() &&
        b.author.toLowerCase() === author.toLowerCase()
    );

    if (duplicate) {
        return res.status(409).json({ error: 'A book with the same title and author already exists' });
    }

    const newBook = {
        id: books.length + 1,
        title,
        author
    };
    books.push(newBook);
    res.status(201).json(newBook);
});


// PUT update book (ID must not change)
app.put('/api/books/:id', requireAuth, (req, res) => {
    const paramId = parseInt(req.params.id);
    const { id: bodyId, title, author } = req.body;

    if (bodyId && bodyId !== paramId) {
        return res.status(400).json({ error: 'Updating book ID is not allowed.' });
    }

    const book = books.find(b => b.id === paramId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    book.title = title || book.title;
    book.author = author || book.author;

    res.status(200).json(book);
});


// DELETE All Books (requires auth + admin)
app.delete('/api/books/reset', requireAuth, requireAdmin, (req, res) => {
    books.length = 0;
    res.status(204).send();
});

// DELETE book (requires auth + admin)
app.delete('/api/books/:id', requireAuth, requireAdmin, (req, res) => {
    const index = books.findIndex(b => b.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Book not found' });

    books.splice(index, 1);
    res.status(204).send();
});

// --------------------------
// 🛑 Global Error Handler
// --------------------------

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong on the server.' });
});

// --------------------------
// 🚀 Start Server
// --------------------------

app.listen(PORT, () => {
    console.log(`Book API is running on http://localhost:${PORT}`);
});
