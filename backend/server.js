const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

dotenv.config();

const app = express();

connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: '*', credentials: true }));

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/contacts', require('./routes/contactRoutes'));
app.use('/api/leads', require('./routes/leadRoutes'));
app.use('/api/opportunities', require('./routes/opportunityRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/activities', require('./routes/activityRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/reports', require('./routes/reportsRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'CRM-Lite Backend Server Running Smoothly', timestamp: new Date() });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 [CRM-Portal API Server] running on PORT ${PORT}`);
});