import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { jwt } from 'jsonwebtoken';

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      'something went wrong while generating access and refresh token'
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { userName, email, fullName, password } = req.body;

  if (
    // some method return true if all variables contain values
    [userName, email, fullName, password].some((field) => field?.trim() === '')
  ) {
    throw new ApiError(400, 'All fields are required!');
  }

  const existingUser = await User.findOne({ $or: [{ userName }, { email }] });

  if (existingUser) {
    throw new ApiError(409, 'User with username or email already exists');
  }

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  // console.log("req.files = ",req.files);

  if (!avatarLocalPath) {
    throw new ApiError(400, 'avatar image is required');
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, 'avatar image is required');
  }

  const user = await User.create({
    userName: userName.toLowerCase(),
    email,
    fullName,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || '',
  });

  const createdUser = await User.findById(user._id).select(
    '-password -refreshToken'
  );

  if (!createdUser) {
    throw new ApiError(500, 'Something went wrong ');
  }
});

const loginUser = asyncHandler(async (req, res) => {
  const { userName, email, password } = req.body;

  if (!(userName || email)) {
    throw new ApiError(400, 'username or email is required');
  }

  const user = await User.findOne({ $or: [{ userName }, { email }] });

  if (!user) {
    throw new ApiError(404, 'user not found!');
  }

  const checkPassword = await user.isPasswordCorrect(password);

  if (!checkPassword) {
    throw new ApiError(401, 'invalid user crenditials');
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    '-password -refreshToken'
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        'User logged in successfully'
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, {}, 'User logged out'));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, 'Unauthorized request');
  }

  try {
    const decodeToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodeToken?._id);

    if (!user) {
      throw new ApiError(401, 'invalid refresh token');
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, 'refresh token is expired or invalid');
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie('accessToken', accessToken, options)
      .cookie('refreshToken', newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          'AccessToken refreshed'
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || 'invalid refresh token');
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const passwordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!passwordCorrect) {
    throw new ApiError(400, 'Invalid old password');
  }

  user.password = newPassword

  await user.save({validateBeforeSave: false})

  return res
  .status(200)
  .json(new ApiResponse(
    200,{}, "password change successfully"
  ))

});

const getCurrentUser = asyncHandler(async(req, res) => {
  return res.status(200).json(
    new ApiResponse(200, req.user, "current user details fetch successfully")
  )
})

const updateAccountsDetails = asyncHandler(async (req, res) => {
  const {fullName, email} = req.body

  if(!fullName || !email){
    throw new ApiError(400, "all fields required")
  }

  const user = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email
      }
    },
    {new: true}
  ).select('-password')

  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      {user},
      "account details updated successfully"
    )
  )
})

const updateAvatarImage = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path

  if(!avatarLocalPath){
    throw new ApiError(400, "Avatar image is required")
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)

  if(!avatar.url){
    throw new ApiError(400, "Error while upload avatar image")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        avatar: avatar.url
      }
    },
    {
      new: true
    }
  ).select('-password')

  return res.status(200).json(
    new ApiResponse(
      200,
      user,
      "avatar image update successfully"
    )
  )

})

const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path

  if(!coverImageLocalPath){
    throw new ApiError(400, "Cover image image is required")
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if(!coverImage.url){
    throw new ApiError(400, "Error while upload cover image")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        coverImage: coverImage.url
      }
    },
    {
      new: true
    }
  ).select('-password')

  return res.status(200).json(
    new ApiResponse(
      200,
      user,
      "Cover image update successfully"
    )
  )
})

export { 
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountsDetails,
  updateAvatarImage,
  updateCoverImage  
 };
