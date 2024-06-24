import {Handler, MSKEvent} from 'aws-lambda';

export const handler: Handler = async (event:MSKEvent,context) => {
  console.log('EVENT: \n' + JSON.stringify(event, null, 2));
  return context.logStreamName;
};