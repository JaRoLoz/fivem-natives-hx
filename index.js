import fetch from 'node-fetch';

const response = await fetch('https://www.npmjs.com/package/@citizenfx/client/file/2f83c0b9a6706e83a1b996af781fb93c14b26fac2491a91325796520377c834a');
const text = await response.text();

const reservedKeyWords = ["var", "dynamic", "override"];
const transformType = (type) => {
    const replacements = {
        "number[]": "Vector3",
        "number": "Number",
        "string": "String",
        "boolean": "Bool",
        "bool": "Bool",
        "any": "Int",
        "object": "Dynamic",
        "void": "Void",
    }
    for (const [key, value] of Object.entries(replacements))
        if (type.toLowerCase().includes(key))
            return value;
    return "Int";
}


const getFunctionName = (line) => {
    const splitted = line.split("(");
    return splitted[0];
}

const getFunctionReturnType = (line) => {
    const splitted = line.split(":");
    const retval = splitted[splitted.length - 1].trim();
    const returnType = retval.startsWith('[')
        ? retval.replace("[", "").replace("]", "").trim().split(",")
        : retval;
    return returnType;
}

const generateMultiReturn = (funcName, types) => {
    const typesStrings = types.map((type, index) => `    var retval${index}:${transformType(type)};`);
    return `@:multiReturn extern class ${funcName}ReturnType {
${typesStrings.join("\n")}
}`;
}

const checkForReservedKeyWords = (name) => {
    if (reservedKeyWords.includes(name))
        return "_" + name;
    return name;
}

const getFunctionParameters = (line) => {
    const splitted = line.split("(");
    const parameters = splitted[1].split(")")[0].split(",");
    if (parameters.length === 1 && parameters[0].trim() === "")
        return [];
    const paramStrings = parameters.map(param => param.trim());
    const paramsArray = paramStrings.map(param =>
        param.trim().split(":"));
    return paramsArray.map(([name, type]) => [checkForReservedKeyWords(name).replace("?", ""), type]);
}

const splitted = text.split("declare function");
const functions = splitted.map(line => line.split(";")[0].trim()).filter(line => !line.startsWith("/*"));
const multiReturns = new Map();
const functionStrings = new Map();
functions.forEach(line => {
    const params = getFunctionParameters(line)
        .map(([name, type]) => [name, transformType(type)]);
    const name = getFunctionName(line);
    const retval = getFunctionReturnType(line);
    if (Array.isArray(retval)) {
        multiReturns.set(`${name}ReturnType;`, generateMultiReturn(name, retval));
        functionStrings.set(name, `static function ${name}(${params.map(([name, type]) => `${name}: ${type}`).join(", ")}):${name}ReturnType;`);
    } else {
        functionStrings.set(name, `static function ${name}(${params.map(([name, type]) => `${name}: ${type}`).join(", ")}):${transformType(retval)};`);
    }
});
functionStrings.set("vector3", "static function vector3(x:Number, y:Number, z:Number):Vector3;");

const template = `typedef Number = Float;

@:native("_G")
extern class Citizen {
	static var source(default, null):Int;
	static function Wait(ms:Int):Void;
	static function CreateThread(callback:Void->Void):Void;
	static function TriggerEvent(eventName:String, ...args:Dynamic):Void;
	static function AddEventHandler(eventName:String, cb:(...Dynamic) -> Void):Void;
	static function TriggerServerEvent(eventName:String, ...args:Dynamic):Void;
	static function RegisterNetEvent(eventName:String, cb:(...Dynamic) -> Void):Void;
	static function SendNUIMessage(message:Dynamic):Void;
	static function SetNuiFocus(hasFocus:Bool, hasCursor:Bool):Void;
	static function SetNuiFocusKeepInput(keepInput:Bool):Void;
	static function RegisterNuiCallback(cbName:String, cb:(Dynamic, (Dynamic) -> Void) -> Void):Void;
}

@:native("_G.json")
extern class Json {
	static function decode(json:String):Dynamic;
	static function encode(value:Dynamic):String;
}

class Vector3 {
	extern public var x:Number;
	extern public var y:Number;
	extern public var z:Number;
}

${Array.from(multiReturns.values()).join("\n")}

@:native("_G")
extern class Natives {
${Array.from(functionStrings.values()).map(str => "    " + str).join("\n")}
}`;

console.log(template);