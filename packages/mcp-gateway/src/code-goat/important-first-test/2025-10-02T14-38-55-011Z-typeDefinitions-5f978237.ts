

interface EchoInput {
message: string
repeat: number
}
interface echoOutput { [key: string]: any }
interface AddInput {
a: number
b: number
}
interface addOutput { [key: string]: any }
interface MultiplyInput {
/**
 * @minItems 1
 */
numbers: [number, ...(number)[]]
precision: number
}
interface multiplyOutput { [key: string]: any }
interface GetWeatherInput {
location: string
unit: ("celsius" | "fahrenheit" | "kelvin")
includeHumidity: boolean
}
interface getWeatherOutput { [key: string]: any }
interface GetTinyImageInput {
color: ("red" | "green" | "blue" | "yellow")
size: ("small" | "medium" | "large")
}
interface getTinyImageOutput { [key: string]: any }
interface LongRunningOperationInput {
/**
 * Duration of the operation in seconds
 */
duration: number
/**
 * Number of steps in the operation
 */
steps: number
}
interface longRunningOperationOutput { [key: string]: any }
interface AnnotatedMessageInput {
title: string
includeImage: boolean
includeResource: boolean
}
interface annotatedMessageOutput { [key: string]: any }
interface ListFilesInput {
path: string
includeHidden: boolean
maxResults: number
}
interface listFilesOutput { [key: string]: any }
interface GenerateIdInput {
type: ("uuid" | "short" | "numeric")
count: number
}
interface generateIdOutput { [key: string]: any }
interface EnableDynamicToolInput {
[k: string]: unknown
}
interface enableDynamicToolOutput { [key: string]: any }
interface ConfirmActionInput {
action: string
riskLevel: ("low" | "medium" | "high")
}
interface confirmActionOutput { [key: string]: any }
interface CollectFormDataInput {
formTitle: string
includeOptional: boolean
}
interface collectFormDataOutput { [key: string]: any }


/*
	Echoes a message with optional repetition
	*/
function echo(input: echoInput): Promise<echoOutput>;

/*
	Adds two numbers together
	*/
function add(input: addInput): Promise<addOutput>;

/*
	Multiplies multiple numbers with optional precision
	*/
function multiply(input: multiplyInput): Promise<multiplyOutput>;

/*
	Gets weather information for a location
	*/
function getWeather(input: getWeatherInput): Promise<getWeatherOutput>;

/*
	Returns a tiny base64 encoded image
	*/
function getTinyImage(input: getTinyImageInput): Promise<getTinyImageOutput>;

/*
	Demonstrates a long running operation with progress updates
	*/
function longRunningOperation(input: longRunningOperationInput): Promise<longRunningOperationOutput>;

/*
	Returns a rich message with multiple content types
	*/
function annotatedMessage(input: annotatedMessageInput): Promise<annotatedMessageOutput>;

/*
	Lists files in a directory (simulated)
	*/
function listFiles(input: listFilesInput): Promise<listFilesOutput>;

/*
	Generates various types of IDs
	*/
function generateId(input: generateIdInput): Promise<generateIdOutput>;

/*
	Registers a new tool named 'dynamicGreet' on demand
	*/
function enableDynamicTool(input: enableDynamicToolInput): Promise<enableDynamicToolOutput>;

/*
	Requests user confirmation before executing an action using elicitation
	*/
function confirmAction(input: confirmActionInput): Promise<confirmActionOutput>;

/*
	Collects structured form data from user using elicitation
	*/
function collectFormData(input: collectFormDataInput): Promise<collectFormDataOutput>;

      