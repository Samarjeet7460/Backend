import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';

const registerUser = asyncHandler(async (req, res) => {
  const { userName, email, fullName, password } = req.body;
  console.log("req.body = ", req.body);
  
  if (
    // some method return true if all variables contain values
    [userName, email, fullName, password].some((field) => field?.trim() === '')
  ) {
    throw new ApiError(400, 'All fields are required!');
  }

  const existingUser = await User.findOne({$or : [{ userName }, { email }]});

  if (existingUser) {
    throw new ApiError(409, 'User with username or email already exists');
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;
  console.log("req.files = ",req.files);
  

  if (!avatarLocalPath) {
    throw new ApiError(400, 'avatar image is required');
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if(!avatar){
    throw new ApiError(400, 'avatar image is required');
  }

  const user = await User.create({
    userName: userName.toLowerCase(),
    email,
    fullName,
    password,
    avatar: avatar.url,
    coverImage : coverImage?.url || ""
  })

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )

  if(!createdUser){
    throw new ApiError(500, "Something went wrong ")
  }

});

export { registerUser };
