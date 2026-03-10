const Link = require('../../model/masterModels/Link');
const crypto = require('crypto');

exports.createSecureLink = async (req, res) => {
    let isSaved = false;
    let finalKey;

    while (!isSaved) {
        try {
            // Generate a high-entropy 6-digit number
            const randomInt = crypto.randomInt(100000, 999999);
            finalKey = randomInt.toString();

            // Attempt to save to the "Links" table
            const newLink = new Link({ 
                key: finalKey,
                isExpired: false,
                createdAt: new Date()
            });

            await newLink.save();
            isSaved = true; // Success! Exit loop.
        } catch (error) {
            // If MongoDB hits a 'Duplicate Key' error (11000), 
            // the loop runs again to generate a new number.
            if (error.code !== 11000) {
                return res.status(500).json({ message: "Database Error", error });
            }
        }
    }

    // Refined for your specific domain
    const generatedUrl = `https://neoform.eniscloud.in/?${finalKey}`;

    res.status(201).json({
        success: true,
        data: {
            key: finalKey,
            link: generatedUrl
        }
    });
};