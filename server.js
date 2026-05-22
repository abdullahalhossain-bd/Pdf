const express = require('express');
const puppeteer = require('puppeteer');
const ejs = require('ejs');
const path = require('path');
const QRCode = require('qrcode');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/v1/documents/generate', async (req, res) => {
    let browser = null;
    try {
        const data = req.body;
        
        const qrString = `Contract:${data.vehicleNo || 'N/A'}-${data.contractDate || 'N/A'}`;
        const qrCodeBase64 = await QRCode.toDataURL(qrString);

        const templatePath = path.join(__dirname, 'views', 'template.ejs');
        const html = await ejs.renderFile(templatePath, { ...data, qrCode: qrCodeBase64 });

        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.evaluateHandle('document.fonts.ready');

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
        return res.status(500).json({ error: "Failed to generate PDF", details: error.message });
    } finally {
        if (browser !== null) await browser.close();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
