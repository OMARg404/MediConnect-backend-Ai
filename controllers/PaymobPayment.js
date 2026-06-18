const axios = require('axios');

const createPayment = async (req, res) => {
    try {
        const { amount, firstName, lastName, email, phone } = req.body;

        if (!amount || !email || !phone) {
            return res.status(400).json({ message: "بيانات العميل أو المبلغ ناقصة" });
        }

        // روابط مباشرة عشان نخلص من Invalid URL
        const API_URL = "https://accept.paymob.com/api";
        
        // سحب الـ Key والتأكد إنه موجود
        const API_KEY = process.env.PAYMOB_API_KEY;
        if (!API_KEY) throw new Error("PAYMOB_API_KEY is missing in .env");

        const amountCents = (parseInt(amount) * 100).toString();

        // 1. Auth Token
        const authResponse = await axios.post(`${API_URL}/auth/tokens`, {
            api_key: API_KEY
        });
        const authToken = authResponse.data.token;

        // 2. Order Registration
        const orderResponse = await axios.post(`${API_URL}/ecommerce/orders`, {
            auth_token: authToken,
            delivery_needed: "false",
            amount_cents: amountCents,
            currency: "EGP",
            items: []
        });
        const orderId = orderResponse.data.id;

        // 3. Payment Key Registration
        const paymentKeyResponse = await axios.post(`${API_URL}/acceptance/payment_keys`, {
            auth_token: authToken,
            amount_cents: amountCents,
            expiration: 3600,
            order_id: orderId,
            billing_data: {
                first_name: firstName || "N/A",
                last_name: lastName || "N/A",
                email: email,
                phone_number: phone,
                apartment: "NA",
                floor: "NA",
                street: "NA",
                building: "NA",
                shipping_method: "NA",
                postal_code: "NA",
                city: "Cairo",
                country: "EG",
                state: "Cairo"
            },
            currency: "EGP",
            integration_id: process.env.PAYMOB_INTEGRATIONS_ID
        });

        const paymentToken = paymentKeyResponse.data.token;

        // 4. Final URL
        const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAMES_ID}?payment_token=${paymentToken}`;

        return res.status(200).json({
            success: true,
            payment_url: iframeUrl,
            order_id: orderId
        });

    } catch (error) {
        console.error("Paymob Error Details:", error.response ? error.response.data : error.message);
        return res.status(500).json({
            success: false,
            message: "حصلت مشكلة في الربط",
            // هنا بنرجع الـ Error اللي طالع من باي موب نفسه عشان نعرف لو الـ Key غلط
            error: error.response ? error.response.data : error.message
        });
    }
};

module.exports = { createPayment };