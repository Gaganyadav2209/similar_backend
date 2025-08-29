import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiResponse.js"

const registerUser = asyncHandler (async (req, res) => {
    // get user details from front-end
    // validation of user details
    // check if user already exists:  username and email
    // check for images
    // check for avatar - compulsory
    // upload images to cloudinary
    // create user object - create entry in db
    // check for user creation
    // send response - remove password and refresh token from response

    const { username, email, fullname, password } = req.body
    console.log(username, email, fullname, password);

    // empty values
    if (
        [fullname, email, username, password].some((field) => {
            return field?.trim() === "";
        })
    ) {
        throw new ApiError(400, "All fields are required")
    }
    // check existing user
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existedUser) {
        throw new ApiError(409, "User already exists")
    }

    // Image handling
    const avatarLocalPath =req.files?.avatar[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(500, "Avatar upload failed")
    }

    const user = await User.create(
        {
            fullname: fullname,
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
            email: email,
            password: password,
            username: username.toLowerCase(),

        }
    )

    const createdUser = await User.findById(user._id).select(
        "-password -refresh_token"
    )

    if (!createdUser) {
        throw new ApiError(500, "User creation failed")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )   


})


export { registerUser }

