class ApiError extends Error{
    constructor(  // overriding the Error class constructor
        statusCode,
        message = "Something went wrong",
        errors = [],
        stack = ""
        
        /*the stack refers to the stack trace, which is a detailed list of function calls and their locations in the code that led up to where the error was thrown. It is extremely useful for debugging because it shows the path the program took to get to the error, including the file names and line numbers.*/
    ){
        super(message) // calling the Error class constructor
        this.statusCode = statusCode
        this.data = null
        this.message = message
        this.success = false
        this.errors = errors

        if(stack){
            this.stack = stack
        }else{
            Error.captureStackTrace(this, this.constructor)
        }
    }
}

export {ApiError}