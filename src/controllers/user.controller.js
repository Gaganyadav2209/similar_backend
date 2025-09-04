import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiResponse.js"
import jwt from "jsonwebtoken" 
import { upload } from "../middlewares/multer.middleware.js"



const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = await user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()

        user.refresh_token = refreshToken
        await user.save({validateBeforeSave: false})
        
        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Internal Server Error, failed to generate refresh and access tokens")
    }

}

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


const loginUser = asyncHandler (async (req,res) => {
    // get user details from front-end
    // validation of user details
    // check if user exists
    // check for password - if incorrect 404
    // access and refresh token
    // send cookie


    const {email, username, password} = req.body

    if (!(username || email)) {
        throw new ApiError(400, "Username or email is required")
    }

    const existingUser = await User.findOne(
        {
            $or: [{username}, {email}]
        }
    )

    if (!existingUser) {
        throw new ApiError(404, "User not found")
    }

    const isPasswordValid = await existingUser.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid Credentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(existingUser._id)

    const loggedInUser = await User.findById(existingUser._id).
    select("-password -refresh_token");

    const options = {
        httpOnly: true,
        secure: true,
    }

    return res.status(200).
    cookie("accessToken",accessToken, options).
    cookie("refreshToken", refreshToken, options).
    json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )
    
})

const logoutUser = asyncHandler (async (req,res) => {
    // find user
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refresh_token: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true,
    }

    return res.status(200).clearCookie("accessToken",options).clearCookie("refreshToken",options)
    .json(
        new ApiResponse(
            200,
            {},
            "User logged out successfully"
        )
    )
    
})

const refreshAccessToken = asyncHandler (async (req,res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodeToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodeToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refresh_token) {
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true,
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res.status(200).
        cookie("accessToken",accessToken, options).
        cookie("refreshToken", newRefreshToken, options).
        json(
            new ApiResponse(
                200,
                {
                    accessToken,
                    refreshToken:newRefreshToken
                },
                "Acess Token Refreshed"
            )
        )
    
    } catch (error) {
        throw new ApiError(
            401,
            error?.message || "Invalid refresh token"
        )
    }


}) 

const changeCurrentPassword = asyncHandler (async (req,res) => {
    const { oldPassword, newPassword, confirmPassword } = req.body

    if (newPassword!==confirmPassword) {
        throw new ApiError(400, "New Password and Confirm Password do not match")
    }  

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Old password is incorrect")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res.status(200).
    json(
        new ApiResponse(
            200,
            {},
            "Password changed successfully"
        )
    )

})

const getCurrentUser = asyncHandler (async (req,res) => {
    return res.status(200).
    json(
        new ApiResponse(
            200,
            {
                user: req.user
            },
            "Current user fetched successfully"
        )
    )
})

const updateAccountDetails = asyncHandler (async (req,res) => {
    const {fullname, email} = req.body

    if (!(fullname || email)) {
        throw new ApiError(400, "Please provide fullname or email")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname: fullname,
                email: email
            }
        },
        {new: true}

    ).select("-password -refresh_token")

    return res.status(200).
    json(
        new ApiResponse(
            200,
            {
                user
            },
            "Account details updated successfully"
        )
    )

})  

const updateUserAvatar = asyncHandler( async(req,res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Please provide avatar")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(500, "Avatar upload failed")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}

    ).select("-password -refresh_token")

    return res.status(200).
    json(
        new ApiResponse(
            200,
            {
                user
            },
            "Avatar updated successfully"
        )
    )   


})

const updateUserCoverImage = asyncHandler( async(req,res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Please provide cover image")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(500, "Cover Image upload failed")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new: true}

    ).select("-password -refresh_token")

    return res.status(200).
    json(
        new ApiResponse(
            200,
            {
                user
            },
            "Cover Image updated successfully"
        )
    )


})

const getUserChannelInfo = asyncHandler( async(req,res) => {
    const { username } = req.params
    if (!username?.trim()) {
        throw new ApiError(400, "Please provide username")
    }
    
    const channel = await User.aggregate(
        [
            {
                $match: {
                    username: username?.toLowerCase()
                }
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers"
                }
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subscriptions"
                }
            },
            {
                $addFields: {
                    subsribersCount: {
                        $size: "$subscribers"
                    },
                    subscriptionCount: {
                        $size: "$subscriptions"
                    },
                    isSubscribed: {
                        $cond: {
                            if: {
                                $in: [req.user?._id, "$subscribers.subscriber"]
                            },
                            then: true,
                            else: false
                        }
                    }
                    
                }
            },
            {
                $project: {
                    fullname: 1,
                    username: 1,
                    subsribersCount: 1,
                    subscriptionCount: 1,
                    isSubscribed: 1,
                    avatar: 1,
                    coverImage: 1,
                    email: 1
                }
            }
        ]
    )

    console.log("###############")
    console.log(channel)
    console.log("###############")
    if (!channel?.length){
        throw new ApiError(404, "Channel not found")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {
                channel: channel[0]
            },
            "Channel info fetched successfully"
        )
    )
})


export { registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelInfo }

