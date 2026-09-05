import { Client } from "@elastic/elasticsearch";

const elasticsearch = new Client({
  node: process.env.ELASTIC_SEARCH_URL,
});

export default elasticsearch;