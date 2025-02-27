const failureResponse = (reason: string) => {
    return {
        success: false,
        message: reason,
        data: {}
    }
}


const doBasePromptsOp = async (opName:string, data:any, errorHandler=(e:any)=>{}) => {
    const op = {
        data: data,
        op: opName
    };

    const response = await fetch('/api/baseprompts/op', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: null,
        body: JSON.stringify(op),
    });


    if (response.ok){
        try {
            const result = await response.json();

            return result;
        } catch (e){
            return {success:false, message:"Error parsing response."};
        }
    }
    else {
        return {success:false, message:`Error calling base prompts: ${response.statusText} .`}
    }
}

const serviceHook = (opName: string) => {

    return async (requestData: any) => {
        console.log(`${opName} request:`, requestData);

        const {success, message, data} = await doBasePromptsOp(
            opName,
            requestData);

        console.log(`${opName} response:`, success, message, data);

        if (!success) {
            return failureResponse(message);
        }

        return {success: true, message: `${opName} success.`, data: data};
    }
}

export const getBasePrompts = async () => {

    const {success, message, data} = await doBasePromptsOp(
        '/base-prompts/get',
        {});

    if(!success){
        return failureResponse(message);
    }

    return {success:true, message:"Base prompts fetched successfully.", data:data};
}
