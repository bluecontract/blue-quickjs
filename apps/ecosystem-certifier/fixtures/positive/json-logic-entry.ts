import jsonLogic from 'json-logic-js';

const payload = JSON.parse(Host.v1.document.get('text/json-logic-case'));
const rule = {
  and: [
    { '>': [{ var: 'score' }, { var: 'threshold' }] },
    { '<=': [{ var: 'threshold' }, 10] },
  ],
};

export default {
  payload,
  passes: Boolean(jsonLogic.apply(rule, payload)),
};
