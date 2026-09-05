import elasticsearch from "./elastic.search.js";

export async function createMessageIndex() {
  const exists = await elasticsearch.indices.exists({
    index: "messages",
  });

  if (!exists) {
    await elasticsearch.indices.create({
      index: "messages",
    });
  }
}

export async function indexMessage(message: {
  messageId: string;
  chatId: string;
  userId: string;
  title: string;
  role: string;
  content: string;
  createdAt: Date;
}) {
  await elasticsearch.index({
    index: "messages",
    id: message.messageId,
    document: message,
  });
}

export async function searchMessages(
  userId: string,
  query: string
) {
  const result = await elasticsearch.search({
    index: "messages",

    query: {
      bool: {
        must: {
          multi_match: {
            query,
            fields: ["title", "content"],
            fuzziness: "AUTO",
          },
        },

        filter: {
          term: {
            userId,
          },
        },
      },
    },

    collapse: {
      field: "chatId",
    },

    sort: [
      {
        createdAt: {
          order: "desc",
        },
      },
    ],
  });

  return result.hits.hits.map((hit) => hit._source);
}

export async function deleteMessagesByChat(
  chatId: string,
  userId: string
) {
  await elasticsearch.deleteByQuery({
    index: "messages",
    query: {
      bool: {
        filter: [
          {
            term: {
              chatId,
            },
          },
          {
            term: {
              userId,
            },
          },
        ],
      },
    },
  });
}