const express = require('express');
const puppeteer = require('puppeteer');
const ejs = require('ejs');
const path = require('path');
const QRCode = require('qrcode');
const cors = require('cors');

const app = express();

// 1. Robust CORS Configuration
app.use(cors({
    origin: 'https://nagoriksheba.com', // Explicitly allow your frontend
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Health Check endpoint (useful for keep-alive)
app.get('/health', (req, res) => res.status(200).send('OK'));

app.post('/api/v1/documents/generate', async (req, res) => {
    let browser = null;
    try {
        const data = req.body;
        const qrString = `Contract:${data.vehicleNo || 'N/A'}-${data.contractDate || 'N/A'}`;
        const qrCodeBase64 = await QRCode.toDataURL(qrString);

        const templatePath = path.join(__dirname, 'views', 'template.ejs');
        const html = await ejs.renderFile(templatePath, { ...data, qrCode: qrCodeBase64 });

        // 2. Optimized Puppeteer Launch for Render Free Tier
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-zygote',
                '--single-process' // Reduces memory usage significantly
            ],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable'
        });

        const page = await browser.newPage();
        
        // 3. Set a reasonable timeout and wait for content
        await page.setContent(html, { 
            waitUntil: 'domcontentloaded', // Faster than networkidle0
            timeout: 30000 
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' }
        });

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="transport-document.pdf"',
            'Content-Length': pdfBuffer.length
        });

        return res.send(pdfBuffer);

    } catch (error) {
        console.error("PDF Error:", error);
        return res.status(500).json({ error: "Failed to generate PDF", details: error.message });
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
