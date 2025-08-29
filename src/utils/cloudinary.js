import { v2 as cloudinary } from 'cloudinary'
import fs from "fs"


cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localfilePath) => {
    try {
        if (!localfilePath) return null;

        // Upload the file to Cloudinary
        const response  = await cloudinary.uploader
       .upload(
            localfilePath, 
            {
                resource_type: "auto",
               public_id: 'shoes',
            }
        )

        // File has been loaded successfully
        console.log("File uploaded to Cloudinary successfully");
        console.log(`Response from Cloudinary: ${response}`);

        return response;

    } catch (error) {
        fs.unlinkSync(localfilePath); // remove the locally save temp file as the upload operation failed
        return null;
    }

}

export { uploadOnCloudinary }



