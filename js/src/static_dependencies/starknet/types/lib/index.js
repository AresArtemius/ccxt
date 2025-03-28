export var TransactionType;
(function (TransactionType) {
    TransactionType["DECLARE"] = "DECLARE";
    TransactionType["DEPLOY"] = "DEPLOY";
    TransactionType["DEPLOY_ACCOUNT"] = "DEPLOY_ACCOUNT";
    TransactionType["INVOKE"] = "INVOKE_FUNCTION";
})(TransactionType || (TransactionType = {}));
/**
 * new statuses are defined by props: finality_status and execution_status
 * to be #deprecated
 */
export var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["NOT_RECEIVED"] = "NOT_RECEIVED";
    TransactionStatus["RECEIVED"] = "RECEIVED";
    TransactionStatus["ACCEPTED_ON_L2"] = "ACCEPTED_ON_L2";
    TransactionStatus["ACCEPTED_ON_L1"] = "ACCEPTED_ON_L1";
    TransactionStatus["REJECTED"] = "REJECTED";
    TransactionStatus["REVERTED"] = "REVERTED";
})(TransactionStatus || (TransactionStatus = {}));
export var TransactionFinalityStatus;
(function (TransactionFinalityStatus) {
    TransactionFinalityStatus["NOT_RECEIVED"] = "NOT_RECEIVED";
    TransactionFinalityStatus["RECEIVED"] = "RECEIVED";
    TransactionFinalityStatus["ACCEPTED_ON_L2"] = "ACCEPTED_ON_L2";
    TransactionFinalityStatus["ACCEPTED_ON_L1"] = "ACCEPTED_ON_L1";
})(TransactionFinalityStatus || (TransactionFinalityStatus = {}));
export var TransactionExecutionStatus;
(function (TransactionExecutionStatus) {
    TransactionExecutionStatus["REJECTED"] = "REJECTED";
    TransactionExecutionStatus["REVERTED"] = "REVERTED";
    TransactionExecutionStatus["SUCCEEDED"] = "SUCCEEDED";
})(TransactionExecutionStatus || (TransactionExecutionStatus = {}));
export var BlockStatus;
(function (BlockStatus) {
    BlockStatus["PENDING"] = "PENDING";
    BlockStatus["ACCEPTED_ON_L1"] = "ACCEPTED_ON_L1";
    BlockStatus["ACCEPTED_ON_L2"] = "ACCEPTED_ON_L2";
    BlockStatus["REJECTED"] = "REJECTED";
})(BlockStatus || (BlockStatus = {}));
export var BlockTag;
(function (BlockTag) {
    BlockTag["pending"] = "pending";
    BlockTag["latest"] = "latest";
})(BlockTag || (BlockTag = {}));
export * from './contract/index.js';
